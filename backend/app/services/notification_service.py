import threading
from datetime import datetime, timedelta
from typing import List
from app.models.case import Case
from app.models.notification import NotificationLog
from app import db


class NotificationService:
    """Handle desktop notifications for urgent cases."""

    def __init__(self, app=None):
        self.app = app
        self._notification_lock = threading.Lock()
        self._plyer_available = None

    def _check_plyer(self) -> bool:
        """Check if plyer is available for desktop notifications."""
        if self._plyer_available is None:
            try:
                from plyer import notification
                self._plyer_available = True
            except ImportError:
                self._plyer_available = False
                print("Warning: plyer not available, desktop notifications disabled")
        return self._plyer_available

    def send_desktop_notification(self, title: str, message: str,
                                   timeout: int = 10) -> bool:
        """Send a desktop notification using plyer."""
        if not self._check_plyer():
            return False

        try:
            from plyer import notification as desktop_notification
            with self._notification_lock:
                desktop_notification.notify(
                    title=title,
                    message=message,
                    app_name='SNOW Tracker',
                    timeout=timeout
                )
                return True
        except Exception as e:
            print(f"Notification error: {e}")
            return False

    def notify_urgent_cases(self, cases: List[Case]) -> int:
        """Send notifications for urgent cases."""
        if not self.app:
            return 0

        notifications_sent = 0
        cooldown_seconds = self.app.config.get('NOTIFICATION_COOLDOWN', 300)

        for case in cases:
            # Check cooldown
            if case.last_notification_at:
                elapsed = (datetime.utcnow() - case.last_notification_at).total_seconds()
                if elapsed < cooldown_seconds:
                    continue

            # Prepare notification message
            if case.sla_status == 'breached':
                title = f"SLA BREACHED: {case.number}"
                message = f"Case {case.number} has breached SLA!"
            else:
                title = f"Urgent: {case.number}"
                minutes = case.sla_minutes_left or 0
                message = f"SLA breach in {minutes} minutes"

            if case.short_description:
                desc = case.short_description[:50]
                if len(case.short_description) > 50:
                    desc += "..."
                message += f"\n{desc}"

            # Send notification
            success = self.send_desktop_notification(
                title=title,
                message=message,
                timeout=15
            )

            # Log notification regardless of delivery success
            log = NotificationLog(
                case_number=case.number,
                notification_type='desktop',
                title=title,
                message=message,
                delivered=success
            )
            db.session.add(log)

            if success:
                # Update case notification timestamp
                case.last_notification_at = datetime.utcnow()
                notifications_sent += 1

        if notifications_sent > 0 or len(cases) > 0:
            db.session.commit()

        return notifications_sent

    def get_recent_notifications(self, limit: int = 20) -> List[NotificationLog]:
        """Get recent notification history."""
        return NotificationLog.query.order_by(
            NotificationLog.created_at.desc()
        ).limit(limit).all()

    def should_notify(self, case: Case) -> bool:
        """Check if we should send notification for this case."""
        if not self.app:
            return False

        if case.last_notification_at is None:
            return True

        cooldown_seconds = self.app.config.get('NOTIFICATION_COOLDOWN', 300)
        cooldown = timedelta(seconds=cooldown_seconds)
        return datetime.utcnow() - case.last_notification_at > cooldown
