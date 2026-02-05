from datetime import datetime
from app import db


class NotificationLog(db.Model):
    """Log of sent notifications for history and debugging."""
    __tablename__ = 'notification_log'

    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(20), nullable=True, index=True)
    notification_type = db.Column(db.String(50), default='desktop')  # desktop, email, etc.
    title = db.Column(db.String(200), nullable=True)
    message = db.Column(db.Text, nullable=True)
    delivered = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'case_number': self.case_number,
            'notification_type': self.notification_type,
            'title': self.title,
            'message': self.message,
            'delivered': self.delivered,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<NotificationLog {self.id}: {self.title}>'
