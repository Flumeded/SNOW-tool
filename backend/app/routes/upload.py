from flask import Blueprint, request, jsonify, current_app
from app.services.csv_parser import CSVParser
from app.services.sla_monitor import SLAMonitor
from app.services.notification_service import NotificationService
from app.services.json_parser import JSONParser

upload_bp = Blueprint('upload', __name__)


@upload_bp.route('/upload', methods=['POST'])
def upload_csv():
    """
    Handle CSV file upload.

    Accepts either:
    - multipart/form-data with 'file' field containing CSV
    - Raw CSV text in request body with content-type text/csv
    """
    csv_content = None

    # Try to get file from form data
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        try:
            csv_content = file.read().decode('utf-8-sig')  # Handle BOM
        except UnicodeDecodeError:
            try:
                file.seek(0)
                csv_content = file.read().decode('latin-1')
            except Exception as e:
                return jsonify({
                    'status': 'error',
                    'error': f'Could not decode file: {str(e)}'
                }), 400

    # Try to get raw CSV from request body
    elif request.content_type and 'text/csv' in request.content_type:
        csv_content = request.get_data(as_text=True)

    # Try JSON with csv_content field
    elif request.is_json:
        data = request.get_json()
        csv_content = data.get('csv_content')

    if not csv_content:
        return jsonify({'error': 'No CSV content provided'}), 400

    try:
        # Parse CSV
        parser = CSVParser(csv_content)
        cases, errors, warnings = parser.parse()

        if errors:
            return jsonify({
                'status': 'error',
                'errors': errors,
                'warnings': warnings,
                'parsed_count': len(cases)
            }), 400

        if not cases:
            return jsonify({
                'status': 'error',
                'error': 'No valid cases found in CSV',
                'warnings': warnings
            }), 400

        # Save to database
        stats = parser.save_to_database(cases)

        # Update SLA statuses
        monitor = SLAMonitor(current_app)
        sla_stats = monitor.update_all_sla_statuses()

        # Check for urgent cases and send notifications
        urgent_cases = monitor.get_urgent_cases()
        notifications_sent = 0

        if urgent_cases and current_app.config.get('ENABLE_NOTIFICATIONS', True):
            notification_service = NotificationService(current_app)
            notifications_sent = notification_service.notify_urgent_cases(urgent_cases)

        return jsonify({
            'status': 'success',
            'case_count': len(cases),
            'new_cases': stats['new_cases'],
            'updated_cases': stats['updated_cases'],
            'urgent_count': len(urgent_cases),
            'notifications_sent': notifications_sent,
            'sla_breakdown': sla_stats,
            'warnings': warnings + parser.warnings,
            'state_changes': stats['state_changes']
        })

    except Exception as e:
        current_app.logger.error(f"Upload error: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@upload_bp.route('/upload-json', methods=['POST'])
def upload_json():
    """
    Handle JSON upload from browser extension.

    Accepts JSON with 'cases' array containing case data.
    """
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 400

    data = request.get_json()

    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    cases_data = data.get('cases', [])

    if not cases_data:
        return jsonify({'error': 'No cases in JSON data'}), 400

    try:
        # Parse and save JSON cases
        parser = JSONParser(cases_data)
        cases, errors, warnings = parser.parse()

        if errors:
            return jsonify({
                'status': 'error',
                'errors': errors,
                'warnings': warnings,
                'parsed_count': len(cases)
            }), 400

        if not cases:
            return jsonify({
                'status': 'error',
                'error': 'No valid cases found in JSON',
                'warnings': warnings
            }), 400

        # Save to database
        stats = parser.save_to_database(cases)

        # Update SLA statuses
        monitor = SLAMonitor(current_app)
        sla_stats = monitor.update_all_sla_statuses()

        # Check for urgent cases and send notifications
        urgent_cases = monitor.get_urgent_cases()
        notifications_sent = 0

        if urgent_cases and current_app.config.get('ENABLE_NOTIFICATIONS', True):
            notification_service = NotificationService(current_app)
            notifications_sent = notification_service.notify_urgent_cases(urgent_cases)

        return jsonify({
            'status': 'success',
            'case_count': len(cases),
            'new_cases': stats['new_cases'],
            'updated_cases': stats['updated_cases'],
            'urgent_count': len(urgent_cases),
            'notifications_sent': notifications_sent,
            'sla_breakdown': sla_stats,
            'warnings': warnings + parser.warnings,
            'state_changes': stats['state_changes'],
            'source': data.get('source', 'unknown'),
            'timestamp': data.get('timestamp')
        })

    except Exception as e:
        current_app.logger.error(f"JSON upload error: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500
