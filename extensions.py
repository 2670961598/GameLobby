from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# Global singleton instances (created once, initialised later via init_app)

db = SQLAlchemy()
# NOTE: `cors_allowed_origins` left open as original behaviour; adjust if needed via Config.
socketio = SocketIO(cors_allowed_origins="*") 