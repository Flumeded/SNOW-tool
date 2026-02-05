from flask import Blueprint, jsonify, request, current_app
from app.models.case import Case
from app.models.settings import Settings
from app.services.sla_monitor import SLAMonitor
from app.services.statistics_service import StatisticsService
from app.services.notification_service import NotificationService

api_bp = Blueprint('api', __name__)


@api_bp.route('/cases', methods=['GET'])
def get_cases():
    """Get all active cases with optional filtering."""
    # Query parameters
    status = request.args.get('status')
    priority = request.args.get('priority')
    sla_status = request.args.get('sla_status')
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    sort_by = request.args.get('sort_by', 'sla_minutes_left')
    sort_order = request.args.get('sort_order', 'asc')

    if include_inactive:
        query = Case.query
    else:
        query = Case.query.filter_by(is_active=True)

    # Apply filters
    if status:
        query = query.filter(Case.sub_state == status)
    if priority:
        query = query.filter(Case.priority == priority)
    if sla_status:
        query = query.filter(Case.sla_status == sla_status)

    # Apply sorting
    sort_column = getattr(Case, sort_by, Case.sla_minutes_left)
    if sort_order == 'desc':
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullslast())

    cases = query.all()

    return jsonify({
        'cases': [case.to_dict() for case in cases],
        'total': len(cases)
    })


@api_bp.route('/cases/<case_number>', methods=['GET'])
def get_case(case_number):
    """Get details for a specific case."""
    case = Case.query.filter_by(number=case_number).first()
    if not case:
        return jsonify({'error': 'Case not found'}), 404
    return jsonify(case.to_dict())


@api_bp.route('/cases/urgent', methods=['GET'])
def get_urgent_cases():
    """Get cases requiring immediate attention."""
    monitor = SLAMonitor(current_app)
    urgent = monitor.get_urgent_cases()
    warning = monitor.get_warning_cases()

    return jsonify({
        'critical': [c.to_dict() for c in urgent],
        'warning': [c.to_dict() for c in warning],
        'critical_count': len(urgent),
        'warning_count': len(warning)
    })


@api_bp.route('/stats/overview', methods=['GET'])
def get_overview_stats():
    """Get dashboard overview statistics."""
    stats_service = StatisticsService()
    return jsonify(stats_service.get_overview_stats())


@api_bp.route('/stats/daily', methods=['GET'])
def get_daily_stats():
    """Get daily statistics."""
    stats_service = StatisticsService()
    return jsonify(stats_service.get_daily_stats())


@api_bp.route('/stats/trend', methods=['GET'])
def get_weekly_trend():
    """Get 7-day trend data."""
    stats_service = StatisticsService()
    return jsonify(stats_service.get_weekly_trend())


@api_bp.route('/settings', methods=['GET'])
def get_settings():
    """Get user settings."""
    settings = {
        'sla_critical_threshold': Settings.get('sla_critical_threshold',
            current_app.config.get('SLA_CRITICAL_THRESHOLD', 30)),
        'sla_warning_threshold': Settings.get('sla_warning_threshold',
            current_app.config.get('SLA_WARNING_THRESHOLD', 120)),
        'notification_cooldown': Settings.get('notification_cooldown',
            current_app.config.get('NOTIFICATION_COOLDOWN', 300)),
        'enable_notifications': Settings.get('enable_notifications',
            current_app.config.get('ENABLE_NOTIFICATIONS', True))
    }
    return jsonify(settings)


@api_bp.route('/settings', methods=['PUT'])
def update_settings():
    """Update user settings."""
    data = request.get_json()

    for key, value in data.items():
        if isinstance(value, bool):
            value_type = 'bool'
        elif isinstance(value, int):
            value_type = 'int'
        else:
            value_type = 'string'
        Settings.set(key, value, value_type)

    return jsonify({'status': 'success'})


@api_bp.route('/notifications/recent', methods=['GET'])
def get_recent_notifications():
    """Get recent notification history."""
    service = NotificationService(current_app)
    notifications = service.get_recent_notifications(limit=20)

    return jsonify([n.to_dict() for n in notifications])


@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0'
    })


@api_bp.route('/reset', methods=['POST'])
def reset_database():
    """Reset all data - for troubleshooting only."""
    from app.models.case_history import CaseHistory
    from app.models.notification import NotificationLog
    from app import db

    try:
        # Delete all records from all tables
        deleted_cases = Case.query.delete()
        deleted_history = CaseHistory.query.delete()
        deleted_notifications = NotificationLog.query.delete()

        db.session.commit()

        return jsonify({
            'status': 'success',
            'deleted': {
                'cases': deleted_cases,
                'history': deleted_history,
                'notifications': deleted_notifications
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
