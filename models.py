from datetime import datetime
from extensions import db

__all__ = [
    'Score',
    'GameConfigModel',
    'UserName',
    'IPBlacklist',
]


class Score(db.Model):
    """Single leaderboard row."""
    __tablename__ = 'scores'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id = db.Column(db.String(64), index=True, nullable=False)
    difficulty = db.Column(db.String(16), index=True, nullable=False)
    player_name = db.Column(db.String(64), nullable=False)
    score = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('game_id', 'difficulty', 'player_name', name='uniq_game_diff_player'),
    )


class GameConfigModel(db.Model):
    """Metadata for every uploaded/built-in game."""
    __tablename__ = 'game_configs'

    game_id = db.Column(db.String(64), primary_key=True)
    ip = db.Column(db.String(45))
    author = db.Column(db.String(64))
    timestamp = db.Column(db.String(32))
    clicks = db.Column(db.Integer, default=0)
    external = db.Column(db.Boolean, default=False)
    link = db.Column(db.String(2048))


class UserName(db.Model):
    """Nickname mapping for each IP."""
    __tablename__ = 'user_names'

    ip = db.Column(db.String(45), primary_key=True)
    name = db.Column(db.String(64), nullable=False)


class IPBlacklist(db.Model):
    """Blacklisted IP addresses."""
    __tablename__ = 'ip_blacklist'

    ip = db.Column(db.String(45), primary_key=True)
    timestamp = db.Column(db.String(32), default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S")) 