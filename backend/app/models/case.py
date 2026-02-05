from datetime import datetime
from app import db


class Case(db.Model):
    __tablename__ = 'cases'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    short_description = db.Column(db.Text, nullable=True)
    time_to_respond = db.Column(db.String(50), nullable=True)
    sla_time_left = db.Column(db.String(50), nullable=True)
    sla_minutes_left = db.Column(db.Integer, nullable=True)  # Parsed SLA in minutes
    sub_state = db.Column(db.String(100), nullable=True, index=True)
    region = db.Column(db.String(50), nullable=True)
    priority = db.Column(db.String(50), nullable=True)
    priority_level = db.Column(db.Integer, nullable=True)  # Numeric: 1=Critical, 2=High, etc.
    sys_updated_on = db.Column(db.DateTime, nullable=True)

    # Tracking fields
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_notification_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    # Computed SLA status
    sla_status = db.Column(db.String(20), default='unknown')  # critical, warning, ok, unknown, breached

    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'short_description': self.short_description,
            'time_to_respond': self.time_to_respond,
            'sla_time_left': self.sla_time_left,
            'sla_minutes_left': self.sla_minutes_left,
            'sub_state': self.sub_state,
            'region': self.region,
            'priority': self.priority,
            'priority_level': self.priority_level,
            'sys_updated_on': self.sys_updated_on.isoformat() if self.sys_updated_on else None,
            'sla_status': self.sla_status,
            'is_active': self.is_active,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Case {self.number}: {self.sub_state}>'
