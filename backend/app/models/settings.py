import json
from app import db


class Settings(db.Model):
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    value_type = db.Column(db.String(20), default='string')  # string, int, bool, json

    @classmethod
    def get(cls, key, default=None):
        setting = cls.query.filter_by(key=key).first()
        if setting is None:
            return default

        if setting.value_type == 'int':
            return int(setting.value)
        elif setting.value_type == 'bool':
            return setting.value.lower() == 'true'
        elif setting.value_type == 'json':
            return json.loads(setting.value)
        return setting.value

    @classmethod
    def set(cls, key, value, value_type='string'):
        setting = cls.query.filter_by(key=key).first()
        if setting is None:
            setting = cls(key=key)
            db.session.add(setting)

        setting.value_type = value_type
        if value_type == 'json':
            setting.value = json.dumps(value)
        else:
            setting.value = str(value)

        db.session.commit()
        return setting

    def __repr__(self):
        return f'<Settings {self.key}={self.value}>'
