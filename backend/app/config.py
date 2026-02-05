import os


def get_bool_env(key, default=True):
    """Get boolean from environment variable."""
    val = os.environ.get(key)
    if val is None:
        return default
    return val.lower() in ('true', '1', 'yes', 'on')


def get_int_env(key, default):
    """Get integer from environment variable."""
    val = os.environ.get(key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


class BaseConfig:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # SLA Thresholds (in minutes) - can be overridden via env vars
    SLA_CRITICAL_THRESHOLD = get_int_env('SLA_CRITICAL_THRESHOLD', 30)
    SLA_WARNING_THRESHOLD = get_int_env('SLA_WARNING_THRESHOLD', 120)

    # Notification settings
    NOTIFICATION_COOLDOWN = get_int_env('NOTIFICATION_COOLDOWN', 300)
    ENABLE_NOTIFICATIONS = get_bool_env('ENABLE_NOTIFICATIONS', True)

    # Scheduler settings
    SCHEDULER_API_ENABLED = True
    SLA_CHECK_INTERVAL = get_int_env('SLA_CHECK_INTERVAL', 60)


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///snow_tracker.db')


class ProductionConfig(BaseConfig):
    DEBUG = False
    ENABLE_NOTIFICATIONS = get_bool_env('ENABLE_NOTIFICATIONS', False)  # Default off in production/Docker
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:////app/data/snow_tracker.db')


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
