from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_apscheduler import APScheduler

db = SQLAlchemy()
scheduler = APScheduler()


def create_app(config_name='development'):
    app = Flask(__name__, instance_relative_config=True)

    # Load configuration
    if config_name == 'development':
        app.config.from_object('app.config.DevelopmentConfig')
    elif config_name == 'production':
        app.config.from_object('app.config.ProductionConfig')
    elif config_name == 'testing':
        app.config.from_object('app.config.TestingConfig')
    else:
        app.config.from_object('app.config.DevelopmentConfig')

    # Initialize extensions
    db.init_app(app)

    # CORS configuration - allow all in production (same-origin via nginx proxy)
    if config_name == 'production':
        CORS(app)  # Allow all origins - nginx handles security
    else:
        CORS(app, origins=['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'])

    scheduler.init_app(app)

    # Register blueprints
    from app.routes.api import api_bp
    from app.routes.upload import upload_bp

    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(upload_bp, url_prefix='/api')

    # Create database tables (ignore if already exist)
    with app.app_context():
        try:
            db.create_all()
        except Exception:
            pass  # Tables already exist

    # Start scheduler for SLA monitoring
    if not scheduler.running:
        scheduler.start()

    return app
