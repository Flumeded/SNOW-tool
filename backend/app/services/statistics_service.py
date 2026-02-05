from datetime import datetime, timedelta
from typing import Dict, List
from sqlalchemy import func, and_
from app.models.case import Case
from app.models.case_history import CaseHistory, STATES_BALL_ON_YOU
from app import db


class StatisticsService:
    """Calculate daily statistics for the dashboard."""

    def get_daily_stats(self, date: datetime = None) -> Dict:
        """Get statistics for a specific day."""
        if date is None:
            date = datetime.utcnow().date()
        elif isinstance(date, datetime):
            date = date.date()

        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())

        # New cases (locked) today - cases first seen
        new_cases = db.session.query(
            func.count(CaseHistory.id)
        ).filter(
            and_(
                CaseHistory.recorded_at >= start_of_day,
                CaseHistory.recorded_at <= end_of_day,
                CaseHistory.event_type == 'new_case'
            )
        ).scalar() or 0

        # Incoming today - customer responded (switched TO open/new)
        incoming = db.session.query(
            func.count(CaseHistory.id)
        ).filter(
            and_(
                CaseHistory.recorded_at >= start_of_day,
                CaseHistory.recorded_at <= end_of_day,
                CaseHistory.event_type == 'incoming'
            )
        ).scalar() or 0

        # Handled today - you responded (switched FROM open/new)
        handled = db.session.query(
            func.count(CaseHistory.id)
        ).filter(
            and_(
                CaseHistory.recorded_at >= start_of_day,
                CaseHistory.recorded_at <= end_of_day,
                CaseHistory.event_type == 'handled'
            )
        ).scalar() or 0

        return {
            'date': date.isoformat(),
            'new_cases': new_cases,   # Locked/first seen
            'incoming': incoming,      # Customer responded
            'handled': handled         # You responded
        }

    def get_overview_stats(self) -> Dict:
        """Get overview statistics for dashboard."""
        # SLA breakdown
        sla_stats = db.session.query(
            Case.sla_status,
            func.count(Case.id)
        ).filter(Case.is_active == True).group_by(Case.sla_status).all()

        sla_breakdown = {status or 'unknown': count for status, count in sla_stats}

        # Priority breakdown
        priority_stats = db.session.query(
            Case.priority,
            func.count(Case.id)
        ).filter(Case.is_active == True).group_by(Case.priority).all()

        priority_breakdown = {priority or 'Unknown': count for priority, count in priority_stats}

        # State breakdown
        state_stats = db.session.query(
            Case.sub_state,
            func.count(Case.id)
        ).filter(Case.is_active == True).group_by(Case.sub_state).all()

        state_breakdown = {state or 'Unknown': count for state, count in state_stats}

        # Region breakdown
        region_stats = db.session.query(
            Case.region,
            func.count(Case.id)
        ).filter(Case.is_active == True).group_by(Case.region).all()

        region_breakdown = {region or 'Unknown': count for region, count in region_stats}

        # Total active
        total_active = Case.query.filter_by(is_active=True).count()

        # Urgent count
        urgent_count = sla_breakdown.get('critical', 0) + sla_breakdown.get('breached', 0)

        # Cases needing action (ball on your side)
        needs_action = db.session.query(
            func.count(Case.id)
        ).filter(
            and_(
                Case.is_active == True,
                func.lower(Case.sub_state).in_(STATES_BALL_ON_YOU)
            )
        ).scalar() or 0

        return {
            'total_active': total_active,
            'needs_action': needs_action,  # Cases where you need to act
            'sla_breakdown': sla_breakdown,
            'priority_breakdown': priority_breakdown,
            'state_breakdown': state_breakdown,
            'region_breakdown': region_breakdown,
            'urgent_count': urgent_count
        }

    def get_weekly_trend(self) -> List[Dict]:
        """Get case trends for the past 7 days."""
        trends = []
        today = datetime.utcnow().date()

        for i in range(7):
            date = today - timedelta(days=i)
            daily = self.get_daily_stats(date)
            trends.append(daily)

        return list(reversed(trends))

    def get_recent_activity(self, limit: int = 20) -> List[Dict]:
        """Get recent state change activity."""
        events = CaseHistory.query.order_by(
            CaseHistory.recorded_at.desc()
        ).limit(limit).all()

        return [e.to_dict() for e in events]

    def get_state_distribution(self) -> Dict[str, int]:
        """Get distribution of cases by state."""
        stats = db.session.query(
            Case.sub_state,
            func.count(Case.id)
        ).filter(Case.is_active == True).group_by(Case.sub_state).all()

        return {state or 'Unknown': count for state, count in stats}
