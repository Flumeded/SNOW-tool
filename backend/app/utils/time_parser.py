import re
from typing import Optional


def parse_sla_time(time_string: str) -> Optional[int]:
    """
    Parse SLA time string to minutes.

    Handles formats like:
    - "2h 30m"
    - "45 minutes"
    - "1 day 2 hours"
    - "2:30:00" (HH:MM:SS)
    - "-0:15:00" (negative time = breached)
    - "30m"
    - "165302" (raw number, likely seconds or minutes)
    """
    if not time_string:
        return None

    time_string = str(time_string).strip().lower()

    # Handle empty or zero values
    if time_string in ('', '0', 'none', 'null'):
        return None

    is_negative = time_string.startswith('-')
    if is_negative:
        time_string = time_string[1:]

    # Try to parse as raw number first (from your CSV it looks like raw values)
    try:
        raw_value = int(float(time_string))
        # If it's a large number, assume it's seconds
        if raw_value > 10000:
            total_minutes = raw_value // 60
        else:
            total_minutes = raw_value
        return -total_minutes if is_negative else total_minutes
    except ValueError:
        pass

    # Try HH:MM:SS format
    hms_match = re.match(r'^(\d+):(\d+):(\d+)$', time_string)
    if hms_match:
        hours, minutes, seconds = map(int, hms_match.groups())
        total_minutes = hours * 60 + minutes + (1 if seconds >= 30 else 0)
        return -total_minutes if is_negative else total_minutes

    # Try HH:MM format
    hm_match = re.match(r'^(\d+):(\d+)$', time_string)
    if hm_match:
        hours, minutes = map(int, hm_match.groups())
        total_minutes = hours * 60 + minutes
        return -total_minutes if is_negative else total_minutes

    # Parse natural language format
    total_minutes = 0
    patterns = [
        (r'(\d+)\s*d(?:ay)?s?', 24 * 60),  # days
        (r'(\d+)\s*h(?:our)?s?', 60),       # hours
        (r'(\d+)\s*m(?:in(?:ute)?)?s?', 1), # minutes
    ]

    for pattern, multiplier in patterns:
        match = re.search(pattern, time_string)
        if match:
            total_minutes += int(match.group(1)) * multiplier

    if total_minutes == 0:
        return None

    return -total_minutes if is_negative else total_minutes


def parse_priority(priority_string: str) -> Optional[int]:
    """
    Parse priority string to numeric level.

    Handles formats like:
    - "2 - High"
    - "2-High"
    - "3 - Moderate"
    - "4 - Low"
    - "P1"
    - "Critical"
    """
    if not priority_string:
        return None

    priority_string = str(priority_string).strip()

    # Try to extract leading number (handles "2 - High", "2-High", etc.)
    match = re.match(r'^(\d+)', priority_string)
    if match:
        return int(match.group(1))

    # Map text priorities
    priority_string_lower = priority_string.lower()
    priority_map = {
        'critical': 1,
        'p1': 1,
        'urgent': 1,
        'high': 2,
        'p2': 2,
        'medium': 3,
        'moderate': 3,
        'p3': 3,
        'low': 4,
        'p4': 4,
        'planning': 5,
        'p5': 5
    }

    for key, value in priority_map.items():
        if key in priority_string_lower:
            return value

    return None


def format_time_remaining(minutes: Optional[int]) -> str:
    """Format minutes back to human-readable string."""
    if minutes is None:
        return "Unknown"

    is_negative = minutes < 0
    minutes = abs(minutes)

    if minutes >= 1440:  # 24 hours
        days = minutes // 1440
        hours = (minutes % 1440) // 60
        result = f"{days}d {hours}h"
    elif minutes >= 60:
        hours = minutes // 60
        mins = minutes % 60
        result = f"{hours}h {mins}m"
    else:
        result = f"{minutes}m"

    return f"-{result}" if is_negative else result
