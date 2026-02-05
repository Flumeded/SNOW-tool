from typing import List, Dict, Optional
from flask import current_app
from app.models.case import Case
from app import db


class SLAMonitor:
    """Monitor SLA status and calculate urgency levels."""

    SLA_STATUS_BREACHED = 'breached'   # Dark red (negative time)
    SLA_STATUS_CRITICAL = 'critical'   # Red
    SLA_STATUS_WARNING = 'warning'     # Yellow
    SLA_STATUS_OK = 'ok'               # Green
    SLA_STATUS_UNKNOWN = 'unknown'     # Gray

    def __init__(self, app=None):
        self.app = app or current_app

    def get_thresholds(self) -> Dict[str, int]:
        """Get SLA thresholds from config."""
        return {
            'critical': self.app.config.get('SLA_CRITICAL_THRESHOLD', 30),
            'warning': self.app.config.get('SLA_WARNING_THRESHOLD', 120),
        }

    def calculate_sla_status(self, minutes_left: Optional[int]) -> str:
        """Determine SLA status based on time remaining."""
        if minutes_left is None:
            return self.SLA_STATUS_UNKNOWN

        thresholds = self.get_thresholds()

        if minutes_left < 0:
            return self.SLA_STATUS_BREACHED
        elif minutes_left <= thresholds['critical']:
            return self.SLA_STATUS_CRITICAL
        elif minutes_left <= thresholds['warning']:
            return self.SLA_STATUS_WARNING
        else:
            return self.SLA_STATUS_OK

    def update_all_sla_statuses(self) -> Dict:
        """Update SLA status for all active cases."""
        stats = {
            'total': 0,
            'breached': 0,
            'critical': 0,
            'warning': 0,
            'ok': 0,
            'unknown': 0
        }

        active_cases = Case.query.filter_by(is_active=True).all()

        for case in active_cases:
            status = self.calculate_sla_status(case.sla_minutes_left)
            case.sla_status = status
            stats['total'] += 1
            stats[status] += 1

        db.session.commit()

        return stats

    def get_urgent_cases(self) -> List[Case]:
        """Get all cases that need immediate attention (critical or breached)."""
        return Case.query.filter(
            Case.is_active == True,
            Case.sla_status.in_([self.SLA_STATUS_CRITICAL, self.SLA_STATUS_BREACHED])
        ).order_by(Case.sla_minutes_left.asc()).all()

    def get_warning_cases(self) -> List[Case]:
        """Get all cases approaching SLA breach."""
        return Case.query.filter(
            Case.is_active == True,
            Case.sla_status == self.SLA_STATUS_WARNING
        ).order_by(Case.sla_minutes_left.asc()).all()

    def get_cases_by_priority(self) -> Dict[str, List[Case]]:
        """Group active cases by priority."""
        cases = Case.query.filter_by(is_active=True).all()

        grouped = {
            'critical': [],
            'high': [],
            'moderate': [],
            'low': [],
            'unknown': []
        }

        priority_map = {
            1: 'critical',
            2: 'high',
            3: 'moderate',
            4: 'low'
        }

        for case in cases:
            key = priority_map.get(case.priority_level, 'unknown')
            grouped[key].append(case)

        return grouped

    def get_cases_by_sla_status(self) -> Dict[str, List[Case]]:
        """Group active cases by SLA status."""
        cases = Case.query.filter_by(is_active=True).all()

        grouped = {
            'breached': [],
            'critical': [],
            'warning': [],
            'ok': [],
            'unknown': []
        }

        for case in cases:
            status = case.sla_status or 'unknown'
            if status in grouped:
                grouped[status].append(case)
            else:
                grouped['unknown'].append(case)

        return grouped
