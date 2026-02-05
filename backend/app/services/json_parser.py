from datetime import datetime
from typing import List, Dict, Tuple, Optional
from app.models.case import Case
from app.models.case_history import CaseHistory
from app.utils.time_parser import parse_sla_time, parse_priority
from app import db


# Field mapping from browser extension JSON to our model
# Keys are possible field names from scraped data, values are our model field names
FIELD_MAPPING = {
    'number': 'number',
    'case': 'number',
    'case_number': 'number',

    'short_description': 'short_description',
    'description': 'short_description',

    'u_time_to_respond': 'time_to_respond',
    'time_to_respond': 'time_to_respond',
    'response_time': 'time_to_respond',

    'sla_time_left': 'sla_time_left',
    'sla': 'sla_time_left',
    'time_left': 'sla_time_left',

    'sub_state': 'sub_state',
    'substate': 'sub_state',
    'state': 'sub_state',

    'region': 'region',

    'priority': 'priority',

    'sys_updated_on': 'sys_updated_on',
    'updated': 'sys_updated_on',
    'last_updated': 'sys_updated_on',
    'updated_on': 'sys_updated_on',
}

# States that indicate a case is no longer active
CLOSED_STATES = {
    'ready to close',
    'closed',
    'resolved',
    'cancelled',
    'canceled',
    'pending autoclose',
}


class JSONParser:
    """Parser for JSON case data from browser extension."""

    def __init__(self, cases_data: List[Dict]):
        self.cases_data = cases_data
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def parse(self) -> Tuple[List[Dict], List[str], List[str]]:
        """Parse JSON case data and return list of normalized case dictionaries."""
        cases = []

        for idx, raw_case in enumerate(self.cases_data):
            try:
                case_data = self._parse_case(raw_case)
                if case_data:
                    cases.append(case_data)
            except Exception as e:
                self.errors.append(f"Case {idx}: {str(e)}")

        return cases, self.errors, self.warnings

    def _parse_case(self, raw_case: Dict) -> Optional[Dict]:
        """Parse a single case dictionary into normalized format."""
        case_data = {}

        # Map fields - try multiple possible field names
        for json_field, model_field in FIELD_MAPPING.items():
            if json_field in raw_case:
                value = raw_case[json_field]
                if value is not None:
                    value = str(value).strip()

                if model_field == 'sys_updated_on' and value:
                    case_data[model_field] = self._parse_datetime(value)
                elif model_field not in case_data or not case_data.get(model_field):
                    # Only set if not already set (first match wins)
                    case_data[model_field] = value if value else None

        # Parse SLA time to minutes
        if case_data.get('sla_time_left'):
            case_data['sla_minutes_left'] = parse_sla_time(case_data['sla_time_left'])

        # Parse priority level
        if case_data.get('priority'):
            case_data['priority_level'] = parse_priority(case_data['priority'])

        # Determine if case is active
        sub_state = case_data.get('sub_state', '')
        case_data['is_active'] = sub_state.lower() not in CLOSED_STATES if sub_state else True

        # Validate required fields
        if not case_data.get('number'):
            return None  # Skip cases without case number

        return case_data

    def _parse_datetime(self, value: str) -> Optional[datetime]:
        """Parse datetime from various formats."""
        if not value:
            return None

        # Common date formats to try
        formats = [
            '%m/%d/%Y %H:%M',       # 2/4/2026 16:46
            '%m/%d/%Y %H:%M:%S',    # 2/4/2026 16:46:00
            '%Y-%m-%d %H:%M:%S',    # 2026-02-04 16:46:00
            '%Y-%m-%dT%H:%M:%S',    # 2026-02-04T16:46:00
            '%Y-%m-%dT%H:%M:%S.%f', # 2026-02-04T16:46:00.000
            '%d/%m/%Y %H:%M',       # 4/2/2026 16:46
            '%d/%m/%Y %H:%M:%S',    # 4/2/2026 16:46:00
            '%b %d, %Y %H:%M',      # Feb 4, 2026 16:46
            '%B %d, %Y %H:%M',      # February 4, 2026 16:46
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue

        self.warnings.append(f"Could not parse date: {value}")
        return None

    def save_to_database(self, cases: List[Dict]) -> Dict:
        """Save parsed cases to database, tracking state transitions."""
        stats = {
            'new_cases': 0,        # First time seeing this case (locked)
            'updated_cases': 0,    # Existing case updated
            'incoming': 0,         # Switched TO open/new (customer responded)
            'handled': 0,          # Switched FROM open/new (you responded)
            'state_changes': []    # Detailed list of changes
        }

        processed_numbers = set()

        for case_data in cases:
            number = case_data['number']
            processed_numbers.add(number)

            existing = Case.query.filter_by(number=number).first()

            if existing:
                # Track state change
                old_state = existing.sub_state
                new_state = case_data.get('sub_state')

                if old_state != new_state:
                    # Determine event type
                    event_type = CaseHistory.determine_event_type(old_state, new_state)

                    stats['state_changes'].append({
                        'number': number,
                        'from': old_state,
                        'to': new_state,
                        'event_type': event_type
                    })

                    # Count incoming/handled
                    if event_type == 'incoming':
                        stats['incoming'] += 1
                    elif event_type == 'handled':
                        stats['handled'] += 1

                    # Record state transition in history
                    history = CaseHistory(
                        case_number=number,
                        previous_state=old_state,
                        new_state=new_state,
                        event_type=event_type,
                        sla_minutes_left=case_data.get('sla_minutes_left'),
                        priority=case_data.get('priority')
                    )
                    db.session.add(history)

                # Update existing case
                for key, value in case_data.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)

                stats['updated_cases'] += 1
            else:
                # Create new case - this is a "locked" case
                new_case = Case(**case_data)
                db.session.add(new_case)
                stats['new_cases'] += 1

                # Record as new case event
                history = CaseHistory(
                    case_number=number,
                    previous_state=None,
                    new_state=case_data.get('sub_state'),
                    event_type='new_case',
                    sla_minutes_left=case_data.get('sla_minutes_left'),
                    priority=case_data.get('priority')
                )
                db.session.add(history)

        # Mark cases not in import as potentially closed (but don't auto-close)
        active_cases = Case.query.filter_by(is_active=True).all()
        for case in active_cases:
            if case.number not in processed_numbers:
                self.warnings.append(f"Case {case.number} not in latest import")

        db.session.commit()

        return stats
