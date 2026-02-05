from datetime import datetime
from app import db


# States where the ball is on YOUR side (you need to act)
STATES_BALL_ON_YOU = {'open', 'new'}

# States where ball is on customer side (you handled it)
STATES_BALL_ON_CUSTOMER = {'pending customer acceptance', 'pending customer'}


class CaseHistory(db.Model):
    """Stores state change events for tracking metrics."""
    __tablename__ = 'case_history'

    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(20), nullable=False, index=True)

    # State transition
    previous_state = db.Column(db.String(100), nullable=True)
    new_state = db.Column(db.String(100), nullable=True)

    # Event type for easy querying
    # 'new_case' - case first appeared
    # 'incoming' - switched TO open/new (customer messaged)
    # 'handled' - switched FROM open/new (you responded)
    # 'state_change' - other state change
    event_type = db.Column(db.String(20), nullable=False, default='state_change', index=True)

    # Additional context
    sla_minutes_left = db.Column(db.Integer, nullable=True)
    priority = db.Column(db.String(50), nullable=True)

    # Timestamp
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    @staticmethod
    def determine_event_type(previous_state, new_state, is_new_case=False):
        """Determine the event type based on state transition."""
        if is_new_case:
            return 'new_case'

        prev_lower = (previous_state or '').lower()
        new_lower = (new_state or '').lower()

        # Switched TO open/new = customer responded (incoming)
        if new_lower in STATES_BALL_ON_YOU and prev_lower not in STATES_BALL_ON_YOU:
            return 'incoming'

        # Switched FROM open/new = you handled it
        if prev_lower in STATES_BALL_ON_YOU and new_lower not in STATES_BALL_ON_YOU:
            return 'handled'

        return 'state_change'

    def to_dict(self):
        return {
            'id': self.id,
            'case_number': self.case_number,
            'previous_state': self.previous_state,
            'new_state': self.new_state,
            'event_type': self.event_type,
            'sla_minutes_left': self.sla_minutes_left,
            'priority': self.priority,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

    def __repr__(self):
        return f'<CaseHistory {self.case_number}: {self.event_type} @ {self.recorded_at}>'
