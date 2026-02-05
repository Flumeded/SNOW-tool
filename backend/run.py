from app import create_app, scheduler
from app.services.sla_monitor import SLAMonitor
from app.services.notification_service import NotificationService

app = create_app()


# Scheduled job for SLA monitoring
@scheduler.task('interval', id='check_sla', seconds=60)
def scheduled_sla_check():
    """Periodically check SLA status and send notifications."""
    with app.app_context():
        monitor = SLAMonitor(app)
        monitor.update_all_sla_statuses()

        if app.config.get('ENABLE_NOTIFICATIONS', True):
            urgent_cases = monitor.get_urgent_cases()
            if urgent_cases:
                notification_service = NotificationService(app)
                notification_service.notify_urgent_cases(urgent_cases)


if __name__ == '__main__':
    print("Starting SNOW Tracker Backend...")
    print("API available at http://localhost:5001")
    print("Upload CSV via POST to http://localhost:5001/api/upload")
    app.run(host='0.0.0.0', port=5001, debug=True)
