from flask import Flask, render_template, request, jsonify, redirect, send_from_directory, Response, g
from datetime import datetime, timedelta
import os
import json
import threading
import werkzeug.utils
import zipfile
import shutil
import mimetypes
import requests
from flask_socketio import emit, join_room, leave_room
from collections import defaultdict
from extensions import db, socketio
from models import Score, GameConfigModel, UserName, IPBlacklist
import logging
from logging.handlers import TimedRotatingFileHandler
import time
from werkzeug.exceptions import HTTPException
import re
import html

app = Flask(__name__, static_folder='static', template_folder='templates')

# ---------------- 安全防护 ----------------

def sanitize_input(text: str, max_length: int = 200) -> str:
    """
    输入过滤和安全检查
    - HTML转义
    - 移除危险标签
    - 长度限制
    """
    if not isinstance(text, str):
        text = str(text)
    
    # 长度限制
    text = text[:max_length]
    
    # HTML转义
    text = html.escape(text, quote=True)
    
    # 移除潜在的JavaScript内容
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>.*?</iframe>',
        r'<object[^>]*>.*?</object>',
        r'<embed[^>]*>.*?</embed>',
        r'<link[^>]*>',
        r'<style[^>]*>.*?</style>',
        r'data:text/html',
        r'vbscript:',
    ]
    
    for pattern in dangerous_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
    
    return text.strip()

def validate_room_name(room_name: str) -> tuple[bool, str]:
    """验证房间名称"""
    if not room_name or not room_name.strip():
        return False, "房间名称不能为空"
    
    room_name = room_name.strip()
    
    if len(room_name) > 50:
        return False, "房间名称过长，最多50个字符"
    
    # 检查特殊字符
    allowed_pattern = r'^[\w\u4e00-\u9fff\s\-_\.]+$'
    if not re.match(allowed_pattern, room_name):
        return False, "房间名称包含非法字符，只允许中文、英文、数字、空格、下划线、横杠和点号"
    
    return True, sanitize_input(room_name, 50)

def check_rate_limit(ip: str, action: str, limit: int = 10, window: int = 60) -> bool:
    """简单的频率限制检查"""
    # 这里可以实现更复杂的频率限制逻辑
    # 暂时简单实现，实际项目中建议使用Redis等
    return True

def enhanced_permission_check(room_id: str, caller_ip: str) -> tuple[bool, str]:
    """增强的权限检查"""
    # 检查房间是否存在
    if room_id not in multiplayer_rooms:
        return False, "房间不存在或已被删除"
    
    room = multiplayer_rooms[room_id]
    
    # 检查是否为房主
    if caller_ip != room.host_ip:
        logger.warning(f"权限拒绝: {caller_ip} 试图操作房间 {room_id}，但不是房主 {room.host_ip}")
        return False, f"只有房主可以执行此操作"
    
    return True, ""

# ---------------- MySQL / SQLAlchemy setup ----------------
# NOTE: make sure you have `pymysql` installed:  pip install flask_sqlalchemy pymysql
# The database `gameplatform` must already exist on your local MySQL server.
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:020126@localhost:3306/gameplatform?charset=utf8mb4'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Vue.js build directory configuration
VUE_BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webGamesVue', 'dist')

# Initialise Flask extensions
db.init_app(app)
socketio.init_app(app)

# -------------------- ORM models --------------------
# (models now defined in models.py; imported above)

# Create tables at startup (idempotent)
with app.app_context():
    db.create_all()

# ---------------- Leaderboard persistence ----------------
DATA_FILE = 'scores.json'
scores_lock = threading.Lock()

# Game identifiers (built-in template games defined here; currently none)
BASE_GAMES: dict[str, dict] = {}

# Folder where users can upload standalone html games (template files)
UPLOAD_FOLDER = os.path.join(app.template_folder, "user_games")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Directory containing additional built-in games placed by developer (each subfolder with index.html)
BUILTIN_GAMES_DIR = os.path.join(app.template_folder, "games")

if not os.path.exists(BUILTIN_GAMES_DIR):
    os.makedirs(BUILTIN_GAMES_DIR, exist_ok=True)

# Ensure .wasm served with correct MIME type
mimetypes.add_type('application/wasm', '.wasm')

# ---------------- Game upload ownership persistence ----------------
# File storing uploader IP info for each single-file HTML game
CONFIG_FILE = 'game_config.json'
# Lock to guard concurrent access to the config dict
config_lock = threading.Lock()

# Default game configurations
DEFAULT_GAME_CONFIG = {
    "maxPlayers": 2,  # Default maximum players for a room
    "minPlayers": 1,  # Default minimum players to start
    "gameType": "multiplayer"  # single, multiplayer, coop
}

# Game-specific configurations
GAME_SPECIFIC_CONFIG = {
    "FiveinaRow": {"maxPlayers": 2, "minPlayers": 2, "gameType": "multiplayer"},
    "shootBall": {"maxPlayers": 1, "gameType": "single"},
    "balloon": {"maxPlayers": 1, "gameType": "single"},
    # Add more game-specific configs here
}

def get_game_config(game_id: str) -> dict:
    """Get game configuration with fallback to defaults."""
    specific_config = GAME_SPECIFIC_CONFIG.get(game_id, {})
    config = DEFAULT_GAME_CONFIG.copy()
    config.update(specific_config)
    return config

def load_game_config() -> dict:
    """Load uploader config from DB; fallback once to JSON for initial migration."""
    result: dict[str, dict] = {}

    # 1. Try DB first
    with app.app_context():
        rows = GameConfigModel.query.all()
        for r in rows:
            result[r.game_id] = {
                "ip": r.ip or "",
                "author": r.author or "匿名",
                "timestamp": r.timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "clicks": r.clicks or 0,
                "external": bool(r.external),
                "link": r.link or "",
            }

    if result:
        return result

    # 2. Fallback – old JSON file exists, migrate its data then persist to DB
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                if isinstance(raw, dict):
                    for k, v in raw.items():
                        key = os.path.splitext(k)[0] if k.lower().endswith('.html') else k
                        result[key] = v
        except Exception:
            pass

        # persist to DB
        with app.app_context():
            for gid, meta in result.items():
                row = GameConfigModel(game_id=gid, ip=meta.get("ip", ""), author=meta.get("author", "匿名"),
                                      timestamp=meta.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                                      clicks=meta.get("clicks", 0), external=meta.get("external", False),
                                      link=meta.get("link", ""))
                db.session.merge(row)  # upsert
            db.session.commit()

    return result

# In-memory mapping from html filename to uploader metadata
game_config: dict[str, dict] = load_game_config()

def save_game_config():
    """Persist in-memory game_config dict to MySQL."""
    with app.app_context():
        for gid, meta in game_config.items():
            row = GameConfigModel.query.get(gid) or GameConfigModel(game_id=gid)
            row.ip = meta.get("ip", "")
            row.author = meta.get("author", "匿名")
            row.timestamp = meta.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            row.clicks = meta.get("clicks", 0)
            row.external = meta.get("external", False)
            row.link = meta.get("link", "")
            db.session.merge(row)
        db.session.commit()

def increment_click(game_id: str):
    """Increment click count and sync to DB."""
    with config_lock:
        entry = game_config.setdefault(game_id, {
            "ip": "",
            "author": "匿名",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "clicks": 0,
        })
        entry["clicks"] = entry.get("clicks", 0) + 1
        save_game_config()

def list_games() -> dict:
    """Return dict of all available games (built-in + uploaded)."""
    games = dict(BASE_GAMES)  # shallow copy

    # Discover games inside templates/games/<game_id>/index.html (both built-in and user uploads)
    try:
        for d in os.listdir(BUILTIN_GAMES_DIR):
            folder_path = os.path.join(BUILTIN_GAMES_DIR, d)
            if not os.path.isdir(folder_path):
                continue
            index_tpl = os.path.join(folder_path, "index.html")
            if not os.path.isfile(index_tpl):
                continue
            game_id = d
            # Avoid overriding existing ids (e.g., BASE_GAMES)
            if game_id in games:
                continue
            with config_lock:
                meta = game_config.get(game_id, {})
            games[game_id] = {
                "name": game_id,
                "template": f"games/{game_id}/index.html",
                "user": bool(meta.get("ip")),  # user-uploaded if has IP recorded
                "folder": True,  # indicates static folder game
            }
    except FileNotFoundError:
        # games directory may not exist; ignore
        pass

    # Legacy support: still include standalone html files in user_games (old uploads)
    for fname in os.listdir(UPLOAD_FOLDER):
        if not fname.lower().endswith(".html"):
            continue
        game_id = os.path.splitext(fname)[0]
        if game_id in games:
            continue
        games[game_id] = {
            "name": game_id,
            "template": f"user_games/{fname}",
            "user": True,
            "folder": False,
        }
    return games


def load_scores():
    """Load all scores from MySQL into nested dict structure expected elsewhere."""
    default_bucket = {"easy": [], "medium": [], "hard": []}
    result = {}

    with app.app_context():
        rows = Score.query.all()

        if not rows and os.path.exists(DATA_FILE):
            # --- initial migration from scores.json ---
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = None

            if data:
                def _store(gid, diff, name, sc):
                    db.session.add(Score(game_id=gid, difficulty=diff, player_name=name, score=int(sc)))

                if isinstance(data, list):
                    # very old schema: list of ints for medium difficulty of 'ball'
                    for s in data:
                        _store('ball', 'medium', 'Unknown', s)
                elif isinstance(data, dict):
                    # Could be game level dict or diff buckets
                    for game_id, maybe_bucket in (data.items() if any(isinstance(v, dict) for v in data.values()) else [('ball', data)]):
                        bucket_by_diff = maybe_bucket if isinstance(maybe_bucket, dict) else {"medium": maybe_bucket}
                        for diff in ("easy", "medium", "hard"):
                            arr = bucket_by_diff.get(diff, [])
                            # arr may be list of dict or list of scores
                            for item in arr:
                                if isinstance(item, dict):
                                    _store(game_id, diff, item.get('name', 'Unknown'), item.get('score', 0))
                                else:
                                    _store(game_id, diff, 'Unknown', item)

                db.session.commit()
                rows = Score.query.all()

        # Populate result dict
        for r in rows:
            result.setdefault(r.game_id, json.loads(json.dumps(default_bucket)))
            result[r.game_id][r.difficulty].append({"name": r.player_name, "score": r.score})

    # sort buckets
    for g in result:
        for diff in result[g]:
            result[g][diff].sort(key=lambda x: x["score"], reverse=True)

    return result


# In-memory score list (per game -> difficulty -> entries)
scores: dict[str, dict[str, list[dict]]] = load_scores()


def save_scores():
    """Persist the global `scores` cache to MySQL (bulk replace)."""
    with app.app_context():
        Score.query.delete()
        for gid, diffs in scores.items():
            for diff, bucket in diffs.items():
                for item in bucket:
                    db.session.add(Score(game_id=gid, difficulty=diff, player_name=item["name"], score=item["score"]))
        db.session.commit()


@app.route('/')
def home():
    """Serve Vue.js built index.html as the main page."""
    return send_from_directory(VUE_BUILD_DIR, 'index.html')


# Serve Vue.js static assets
@app.route('/assets/<path:filename>')
def vue_assets(filename):
    """Serve Vue.js built assets."""
    return send_from_directory(os.path.join(VUE_BUILD_DIR, 'assets'), filename)


# Legacy home route for backward compatibility (moved to /admin or /legacy)
@app.route('/admin')
def admin_home():
    """Legacy admin page listing available games."""
    all_games = list_games()
    # Fetch which games currently have leaderboard entries (single query)
    with app.app_context():
        games_with_scores = {gid for (gid,) in db.session.query(Score.game_id).distinct().all()}

    enhanced = {}
    now_str=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    changed=False
    for gid, g in all_games.items():
        info = dict(g)
        with config_lock:
            meta = game_config.get(gid, {})
        # ensure timestamp
        if not meta.get("timestamp"):
            meta["timestamp"] = now_str
            game_config[gid] = meta
            changed=True

        info["author"] = meta.get("author", "匿名")
        info["timestamp"] = meta.get("timestamp", now_str)
        info["clicks"] = meta.get("clicks", 0)

        # Determine preview image
        preview_url = "/games/preview.png"
        if info.get("folder"):
            for ext in ("png", "jpg", "jpeg", "gif"):
                cand_path = os.path.join(app.template_folder, "games", gid, f"preview.{ext}")
                if os.path.isfile(cand_path):
                    preview_url = f"/game/{gid}/preview.{ext}"
                    break
        info["preview"] = preview_url

        info["has_leaderboard"] = gid in games_with_scores

        enhanced[gid] = info

    if changed:
        save_game_config()

    # Sorting options
    sort_mode = request.args.get('sort', 'default')
    def sort_key(item):
        if sort_mode == 'clicks':
            return (-item[1]['clicks'], item[0])
        if sort_mode == 'time':
            try:
                ts = datetime.strptime(item[1]['timestamp'], "%Y-%m-%d %H:%M:%S")
            except Exception:
                ts = datetime.min
            return (-ts.timestamp(), item[0])
        # default alphabetical
        return (item[0],)

    ordered = dict(sorted(enhanced.items(), key=sort_key))

    tiles = ordered

    # Prepare ranking by clicks
    ranking = []
    with config_lock:
        for gid, info in all_games.items():
            meta = game_config.get(gid, {})
            ranking.append({
                "id": gid,
                "name": info.get("name", gid),
                "author": meta.get("author", "匿名"),
                "clicks": meta.get("clicks", 0),
                "timestamp": meta.get("timestamp", now_str),
            })
    ranking.sort(key=lambda x: x["clicks"], reverse=True)

    hot_top5 = ranking[:5]

    # recent top5 by time
    recent_sorted = sorted(ranking, key=lambda x: datetime.strptime(x["timestamp"], "%Y-%m-%d %H:%M:%S"), reverse=True)
    recent_top5 = recent_sorted[:5]

    return render_template('home.html', tiles=tiles, ranking=ranking, sort_mode=sort_mode, recent_list=recent_top5, hot_list=hot_top5)


# Game main page (index)
@app.route('/game/<game_id>/')
def game_page(game_id):
    games = list_games()
    if game_id not in games:
        return f"未知游戏 {game_id}", 404

    info = games[game_id]

    # Record click count
    increment_click(game_id)

    if info.get("folder"):
        folder_path = os.path.join(app.template_folder, "games", game_id)
        return send_from_directory(folder_path, "index.html")

    return render_template(info["template"])


# Redirect /game/<id> to /game/<id>/ for folder games so relative resources resolve
@app.route('/game/<game_id>')
def game_page_redirect(game_id):
    games = list_games()
    if game_id in games and games[game_id].get("folder"):
        qs = request.query_string.decode()
        return redirect(f"/game/{game_id}/" + (f"?{qs}" if qs else ""))
    # else treat as template-based
    return game_page(game_id)


@app.route('/submit-score', methods=['POST'])
def submit_score():
    """Receive final score and store directly to MySQL leaderboard."""
    data = request.get_json(force=True)
    
    # 提取参数
    game_id = str(data.get("game", "")).strip()
    difficulty = str(data.get("difficulty", "medium")).lower()
    player_name = str(data.get("name", "")).strip() or "匿名玩家"
    score_val = data.get("score", 0)

    # 调用统一的服务层逻辑
    result = service_submit_score(game_id, difficulty, player_name, score_val)
    
    if not result.success:
        return jsonify({"status": "error", "msg": result.error_msg}), 400

    # 返回传统接口格式
    return jsonify({
        "status": "ok", 
        "rank": result.rank, 
        "total": result.total, 
        "percent": result.percent, 
        "difficulty": result.difficulty, 
        "game": result.game_id
    })


@app.route('/leaderboard/<game_id>')
def leaderboard(game_id):
    """Render leaderboard page for a given game (data from MySQL)."""
    # 调用统一的服务层逻辑
    sorted_scores = service_get_leaderboard(game_id, limit=50)
    
    if sorted_scores is None:
        return f"未知游戏 {game_id}", 404

    return render_template("leaderboard.html", scores=sorted_scores, game=game_id)


# Upload route
@app.route('/upload-game', methods=['POST'])
def upload_game():
    """Handle user HTML upload with ownership tracking & overwrite rules."""
    if 'game_file' not in request.files:
        return "No file part", 400
    file = request.files['game_file']
    if file.filename == '' or not file.filename.lower().endswith('.html'):
        return "Invalid file", 400

    filename = werkzeug.utils.secure_filename(file.filename)
    game_id = os.path.splitext(filename)[0]
    uploader_ip = request.remote_addr or "unknown"
    author_name = request.form.get('author', '').strip() or '匿名'

    dest_dir = os.path.join(BUILTIN_GAMES_DIR, game_id)

    with config_lock:
        owner_ip = game_config.get(game_id, {}).get("ip", "")

        # If exists and different owner
        if os.path.exists(dest_dir) and owner_ip and owner_ip != uploader_ip:
            return "该游戏已存在，且您不是作者，无法覆盖", 403

        # Recreate folder (overwrite)
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir)
        os.makedirs(dest_dir, exist_ok=True)

        # Save uploaded html as index.html inside folder
        file.save(os.path.join(dest_dir, "index.html"))

        # Record / update metadata
        meta = game_config.get(game_id, {})
        meta.update({
            "ip": uploader_ip,
            "author": author_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "clicks": meta.get("clicks", 0),
        })
        game_config[game_id] = meta
        save_game_config()

    return redirect('/')


# Static files inside folder-based games
@app.route('/game/<game_id>/<path:filename>')
def game_assets(game_id, filename):
    folder_path = os.path.join(app.template_folder, "games", game_id)
    if not os.path.isdir(folder_path):
        return "", 404

    full_path = os.path.join(folder_path, filename)
    if not os.path.isfile(full_path):
        return "", 404

    resp = send_from_directory(folder_path, filename)

    # Support Unity compressed builds (.br / .gz)
    if filename.endswith('.br'):
        resp.headers['Content-Encoding'] = 'br'
        resp.headers['Content-Type'] = mimetypes.guess_type(filename[:-3])[0] or 'application/octet-stream'
    elif filename.endswith('.gz'):
        resp.headers['Content-Encoding'] = 'gzip'
        resp.headers['Content-Type'] = mimetypes.guess_type(filename[:-3])[0] or 'application/octet-stream'

    return resp


# --------------- ZIP upload ---------------

def safe_extract(zipf: zipfile.ZipFile, path: str, *, max_size: int = 200 * 1024 * 1024):
    """Extract zip safely, guarding against path traversal, symlinks and zip-bombs.

    Parameters
    ----------
    zipf : ZipFile
        Opened zip archive.
    path : str
        Destination directory (must already exist).
    max_size : int
        Maximum total uncompressed bytes allowed; default 200 MB.
    """
    path = os.path.abspath(path)
    total_size = 0

    for member in zipf.infolist():
        # ---- 1. 路径穿越防护 ----
        fname = member.filename
        if os.path.isabs(fname) or fname.startswith('..'):
            raise ValueError("非法 zip 路径")
        abs_target = os.path.abspath(os.path.join(path, fname))
        if not abs_target.startswith(path + os.sep):
            raise ValueError("非法 zip 路径")

        # ---- 2. 禁止符号链接 ----
        is_symlink = (member.external_attr >> 16) & 0o170000 == 0o120000
        if is_symlink:
            raise ValueError("不允许包含符号链接")

        # ---- 3. 总体大小限制，防 zip-bomb ----
        total_size += member.file_size
        if total_size > max_size:
            raise ValueError("压缩包过大")

    zipf.extractall(path)


@app.route('/upload-zip', methods=['POST'])
def upload_zip():
    if 'zip_file' not in request.files:
        return "缺少 zip 文件", 400
    file = request.files['zip_file']
    if file.filename == '' or not file.filename.lower().endswith('.zip'):
        return "文件必须为 .zip", 400

    game_id = request.form.get('game_id', '').strip()
    if not game_id or not game_id.isalnum():
        return "游戏ID 必须为纯英文或数字组合", 400
    game_id = game_id.lower()

    uploader_ip = request.remote_addr or "unknown"
    author_name = request.form.get('author', '').strip() or '匿名'

    # 不允许覆盖内置官方游戏
    if game_id in BASE_GAMES:
        return "官方游戏不能覆盖", 403

    dest_dir = os.path.join(BUILTIN_GAMES_DIR, game_id)

    with config_lock:
        owner_ip = game_config.get(game_id, {}).get('ip', '')
        if os.path.exists(dest_dir) and owner_ip and owner_ip != uploader_ip:
            return "该游戏已存在，且您不是作者，无法覆盖", 403

        # Remove existing folder to overwrite (if any)
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir)

        os.makedirs(dest_dir, exist_ok=True)

    tmp_path = dest_dir + '.zip'
    file.save(tmp_path)

    try:
        with zipfile.ZipFile(tmp_path, 'r') as zf:
            safe_extract(zf, dest_dir)
    except Exception as e:
        shutil.rmtree(dest_dir, ignore_errors=True)
        os.remove(tmp_path)
        return f"解压失败: {e}", 400

    os.remove(tmp_path)

    # 如果解压后只有一个子文件夹，提取其内容
    try:
        entries = os.listdir(dest_dir)
        if len(entries) == 1 and os.path.isdir(os.path.join(dest_dir, entries[0])):
            inner_dir = os.path.join(dest_dir, entries[0])
            for item in os.listdir(inner_dir):
                shutil.move(os.path.join(inner_dir, item), dest_dir)
            shutil.rmtree(inner_dir)
    except Exception:
        pass

    if not os.path.isfile(os.path.join(dest_dir, 'index.html')):
        shutil.rmtree(dest_dir, ignore_errors=True)
        return "压缩包无效: 缺少 index.html", 400

    # Update metadata once everything succeeds
    with config_lock:
        meta = game_config.get(game_id, {})
        meta.update({
            "ip": uploader_ip,
            "author": author_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "clicks": meta.get("clicks", 0),
        })
        game_config[game_id] = meta
        save_game_config()

    return redirect('/')


# ----------- External link game upload ------------

@app.route('/upload-link', methods=['POST'])
def upload_link():
    """Allow users to register an external web game by providing preview image, name, link and author."""
    if 'image_file' not in request.files:
        return "缺少预览图", 400

    img = request.files['image_file']
    if img.filename == '' or not any(img.filename.lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.gif')):
        return "无效的图片格式", 400

    game_id_raw = request.form.get('game_id', '').strip()
    if not game_id_raw or not game_id_raw.isalnum():
        return "游戏ID 必须为纯英文或数字组合", 400
    game_id = game_id_raw.lower()

    target_link = request.form.get('link', '').strip()
    if not (target_link.startswith('http://') or target_link.startswith('https://')):
        return "链接必须以 http:// 或 https:// 开头", 400

    author_name = request.form.get('author', '').strip() or '匿名'
    uploader_ip = request.remote_addr or 'unknown'

    if game_id in BASE_GAMES:
        return "官方游戏不能覆盖", 403

    dest_dir = os.path.join(BUILTIN_GAMES_DIR, game_id)

    with config_lock:
        owner_ip = game_config.get(game_id, {}).get('ip', '')
        if os.path.exists(dest_dir) and owner_ip and owner_ip != uploader_ip:
            return "该游戏已存在，且您不是作者，无法覆盖", 403

        # Recreate dir
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir)
        os.makedirs(dest_dir, exist_ok=True)

        # Save preview image as preview.png/jpg according to extension
        img_ext = os.path.splitext(img.filename)[1].lower()
        img_save_name = f'preview{img_ext}'
        img.save(os.path.join(dest_dir, img_save_name))

        # Generate index.html that redirects
        html_content = f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
    <meta charset=\"utf-8\">
    <title>{game_id}</title>
    <meta http-equiv=\"refresh\" content=\"0;url={target_link}\">
    <style>body{{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial,Helvetica,sans-serif;}}</style>
</head>
<body>
    <div>正在跳转到游戏... 如果浏览器没有自动跳转，请 <a href=\"{target_link}\">点击这里</a></div>
    <script>window.location.replace('{target_link}');</script>
</body>
</html>"""
        with open(os.path.join(dest_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Update metadata
        meta = game_config.get(game_id, {})
        meta.update({
            'ip': uploader_ip,
            'author': author_name,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'clicks': meta.get('clicks', 0),
            'external': True,
            'link': target_link,
        })
        game_config[game_id] = meta
        save_game_config()

    return redirect('/')


# ---------------- 新的联机游戏系统 ----------------

import random
import threading
import time
from flask_socketio import emit, join_room, leave_room, disconnect
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Set
from datetime import datetime

# 联机系统数据结构
@dataclass
class Room:
    """房间基础信息（Web服务器层）"""
    room_id: str
    room_name: str
    host_ip: str
    current_players: int = 0
    max_players: int = 20
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class GameRoom:
    """游戏房间信息（游戏服务器层）"""
    room_id: str
    game_mode: str  # "p2p" or "服务器中继"
    sync_type: str  # "状态同步", "帧同步", "用户自定义"
    players: List[str] = field(default_factory=list)  # IP列表
    custom_info: Dict[str, Any] = field(default_factory=dict)
    
    # 状态同步相关
    last_state: Optional[bytes] = None
    
    # 帧同步相关
    player_queues: Dict[str, deque] = field(default_factory=dict)  # 每个玩家的操作队列
    tick_count: int = 0
    last_tick_time: float = field(default_factory=time.time)
    
    # WebSocket连接管理
    websocket_connections: Dict[str, str] = field(default_factory=dict)  # ip -> session_id

# 全局内存存储
multiplayer_rooms: Dict[str, Room] = {}  # 房间ID -> 房间基础信息
game_rooms: Dict[str, GameRoom] = {}  # 房间ID -> 游戏房间信息
room_locks: Dict[str, threading.Lock] = {}  # 房间级别的锁
multiplayer_lock = threading.Lock()  # 全局锁

# 帧同步配置
FRAME_RATE = 16  # 16 tick/秒
TICK_INTERVAL = 1.0 / FRAME_RATE  # 62.5ms
MAX_QUEUE_SIZE = 10  # 操作队列最大长度
MAX_STATE_SIZE = 10 * 1024 * 1024  # 状态数据最大10MB

# 房间帧同步管理（每个房间独立协程）
room_frame_sync_tasks: Dict[str, Any] = {}  # room_id -> background_task
room_frame_sync_lock = threading.Lock()

def generate_room_id() -> str:
    """生成房间ID：时间戳 + 随机正整数"""
    timestamp = int(time.time() * 1000)  # 毫秒时间戳
    random_num = random.randint(100000, 999999)
    return f"{timestamp}{random_num}"

def get_room_lock(room_id: str) -> threading.Lock:
    """获取房间锁"""
    # 使用非阻塞方式获取全局锁
    if not multiplayer_lock.acquire(blocking=False):
        # 如果无法立即获取锁，创建一个新的锁并返回
        # 这可能导致短暂的不一致，但避免了死锁
        logger.warning(f"无法获取全局锁来访问房间锁 {room_id}，创建临时锁")
        return threading.Lock()
    
    try:
        if room_id not in room_locks:
            room_locks[room_id] = threading.Lock()
        return room_locks[room_id]
    finally:
        multiplayer_lock.release()

def cleanup_room(room_id: str):
    """清理房间数据"""
    # 不要在函数内获取锁，由调用者负责获取适当的锁
    # 这个函数假设调用者已经持有multiplayer_lock
    if room_id in multiplayer_rooms:
        multiplayer_rooms.pop(room_id, None)
    
    if room_id in game_rooms:
        game_rooms.pop(room_id, None)
    
    if room_id in room_locks:
        room_locks.pop(room_id, None)
    
    # 停止房间的帧同步协程
    stop_room_frame_sync(room_id)
    
    logger.info(f"房间 {room_id} 已清理")

# ============ Web服务器层接口 ============

@app.route('/api/multiplayer/create_room', methods=['POST'])
def create_room():
    """创建房间接口"""
    data = request.get_json(force=True)
    room_name_raw = str(data.get('room_name', '')).strip()
    
    # 输入验证和安全检查
    valid, result = validate_room_name(room_name_raw)
    if not valid:
        return jsonify({'error': result}), 400
    
    room_name = result
    host_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
    
    # 频率限制检查
    if not check_rate_limit(host_ip, 'create_room'):
        return jsonify({'error': '操作过于频繁，请稍后重试'}), 429
    
    room_id = generate_room_id()
    
    # 创建房间
    room = Room(
        room_id=room_id,
        room_name=room_name,
        host_ip=host_ip,
        current_players=1
    )
    
    with multiplayer_lock:
        multiplayer_rooms[room_id] = room
    
    logger.info(f'Room created: {room_id} by {host_ip}, name: {room_name}')
    
    return jsonify({
        'success': True,
        'room_id': room_id,
        'room_name': room_name,
        'host_ip': host_ip
    })

@app.route('/api/multiplayer/rooms', methods=['GET'])
def get_rooms():
    """获取房间列表"""
    rooms_list = []
    
    with multiplayer_lock:
        for room_id, room in multiplayer_rooms.items():
            rooms_list.append({
                'room_id': room.room_id,
                'room_name': room.room_name,
                'host_ip': room.host_ip,
                'current_players': room.current_players,
                'max_players': room.max_players,
                'created_at': room.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
    
    # 按创建时间排序，最新的在前
    rooms_list.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({'rooms': rooms_list})

@app.route('/api/multiplayer/join_room', methods=['POST'])
def join_room_api():
    """加入房间接口"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    with multiplayer_lock:
        if room_id not in multiplayer_rooms:
            return jsonify({'error': '房间不存在'}), 404
        
        room = multiplayer_rooms[room_id]
        game_room = game_rooms.get(room_id)
    
    player_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
    
    # 检查房间是否已满
    if room.current_players >= room.max_players:
        return jsonify({'error': '房间已满'}), 400
    
    # 如果是P2P模式，只返回房主IP
    if game_room and game_room.game_mode == 'p2p':
        return jsonify({
            'success': True,
            'mode': 'p2p',
            'host_ip': room.host_ip
        })
    
    # 如果是服务器中继模式或未初始化，加入游戏服务器
    if game_room and game_room.game_mode == '服务器中继':
        with get_room_lock(room_id):
            if player_ip not in game_room.players:
                game_room.players.append(player_ip)
                room.current_players = len(game_room.players)
                
                # 初始化玩家操作队列（帧同步用）
                if game_room.sync_type == '帧同步':
                    game_room.player_queues[player_ip] = deque(maxlen=MAX_QUEUE_SIZE)
        
        return jsonify({
            'success': True,
            'mode': '服务器中继',
            'room_id': room_id,
            'sync_type': game_room.sync_type,
            'players': game_room.players
        })
    
    # 房间未初始化，等待房主调用 update_info
    return jsonify({
        'success': True,
        'mode': 'waiting',
        'message': '等待房主初始化游戏设置'
    })

# ============ 游戏服务器层接口 ============

@app.route('/api/multiplayer/update_info', methods=['POST'])
def update_info():
    """更新房间信息接口（仅房主可用）"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    caller_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
    
    # 增强的权限检查
    with multiplayer_lock:
        has_permission, error_msg = enhanced_permission_check(room_id, caller_ip)
        if not has_permission:
            return jsonify({'error': error_msg, 'caller_ip': caller_ip, 'host_ip': multiplayer_rooms.get(room_id, {}).host_ip if room_id in multiplayer_rooms else 'unknown'}), 403
        
        room = multiplayer_rooms[room_id]
    
    # 提取配置信息并进行输入验证
    game_mode = str(data.get('game_mode', '')).strip()
    sync_type = str(data.get('sync_type', '')).strip()
    players_list = data.get('players', [])
    custom_info = data.get('custom_info', {})
    
    # 输入验证
    if game_mode not in ['p2p', '服务器中继']:
        return jsonify({'error': '游戏模式必须是 p2p 或 服务器中继'}), 400
    
    if sync_type not in ['状态同步', '帧同步', '用户自定义']:
        return jsonify({'error': '同步类型必须是 状态同步、帧同步 或 用户自定义'}), 400
    
    # 对自定义信息进行安全过滤
    if isinstance(custom_info, dict):
        filtered_custom_info = {}
        for key, value in custom_info.items():
            if isinstance(key, str) and isinstance(value, (str, int, float, bool)):
                safe_key = sanitize_input(str(key), 50)
                if isinstance(value, str):
                    safe_value = sanitize_input(str(value), 500)
                else:
                    safe_value = value
                filtered_custom_info[safe_key] = safe_value
        custom_info = filtered_custom_info
    
    with get_room_lock(room_id):
        # 首次初始化或更新游戏房间
        if room_id not in game_rooms:
            # 首次初始化
            game_room = GameRoom(
                room_id=room_id,
                game_mode=game_mode,
                sync_type=sync_type,
                players=[room.host_ip],  # 房主默认在房间内
                custom_info=custom_info
            )
            
            # 如果是帧同步，初始化房主的操作队列
            if sync_type == '帧同步':
                game_room.player_queues[room.host_ip] = deque(maxlen=MAX_QUEUE_SIZE)
            
            with multiplayer_lock:
                game_rooms[room_id] = game_room
            
            # 如果是帧同步房间，启动房间的帧同步协程
            if sync_type == '帧同步':
                start_room_frame_sync(room_id)
            
            logger.info(f'Game room initialized: {room_id}, mode: {game_mode}, sync: {sync_type}')
        else:
            # 更新现有房间（不允许修改模式和同步类型）
            game_room = game_rooms[room_id]
            
            # 更新玩家列表
            old_players = set(game_room.players)
            new_players = set(players_list)
            
            # 添加新玩家
            for player_ip in new_players - old_players:
                if game_room.sync_type == '帧同步':
                    game_room.player_queues[player_ip] = deque(maxlen=MAX_QUEUE_SIZE)
            
            # 移除离开的玩家
            for player_ip in old_players - new_players:
                if player_ip in game_room.player_queues:
                    del game_room.player_queues[player_ip]
                if player_ip in game_room.websocket_connections:
                    del game_room.websocket_connections[player_ip]
            
            game_room.players = list(new_players)
            game_room.custom_info.update(custom_info)
            
            # 更新房间人数
            room.current_players = len(game_room.players)
    
    return jsonify({
        'success': True,
        'message': '房间信息更新成功',
        'game_mode': game_mode,
        'sync_type': sync_type,
        'players_count': len(game_room.players)
    })

@app.route('/api/multiplayer/submit_state', methods=['POST'])
def submit_state():
    """提交游戏状态/操作"""
    try:
        data = request.get_json(force=True)
        room_id = str(data.get('room_id', '')).strip()
        
        if not room_id:
            return jsonify({'error': '房间ID不能为空'}), 400
            
        # 获取数据内容
        game_data = data.get('data')
        if game_data is None:
            return jsonify({'error': '缺少游戏数据'}), 400
        
        # 对游戏数据进行安全检查
        def contains_xss(obj, max_depth=5):
            """检查数据是否包含XSS攻击代码"""
            if max_depth <= 0:
                return False
                
            if isinstance(obj, str):
                # 检查常见的XSS攻击模式
                xss_patterns = [
                    r'<script[^>]*>.*?</script>',
                    r'<iframe[^>]*>.*?</iframe>',
                    r'<object[^>]*>.*?</object>',
                    r'<embed[^>]*>.*?</embed>',
                    r'<link[^>]*>',
                    r'<style[^>]*>.*?</style>',
                    r'javascript\s*:',
                    r'on\w+\s*=',
                    r'data\s*:\s*text/html',
                    r'vbscript\s*:',
                    r'expression\s*\(',
                    r'<[^>]*>[^<]*alert\s*\(',
                    r'<[^>]*>[^<]*eval\s*\(',
                ]
                
                import re

                
                for pattern in xss_patterns:
                    if re.search(pattern, obj, re.IGNORECASE | re.DOTALL):
                        return True
                return False
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    if contains_xss(str(k)) or contains_xss(v, max_depth - 1):
                        return True
            elif isinstance(obj, list):
                for item in obj:
                    if contains_xss(item, max_depth - 1):
                        return True
            
            return False
        
        # 检查是否包含XSS攻击代码
        if contains_xss(game_data):
            logger.warning(f"检测到XSS攻击尝试，拒绝请求: {player_ip}")
            return jsonify({'error': '提交的数据包含非法内容，请检查后重新提交'}), 400
        
        # 对游戏数据进行基本过滤（保留原有的过滤逻辑作为额外防护）
        def sanitize_game_data(obj, max_depth=5):
            """递归地对游戏数据进行安全过滤"""
            if max_depth <= 0:
                return obj
                
            if isinstance(obj, str):
                # 基本的安全过滤
                sanitized = sanitize_input(obj, 1000)  # 游戏数据可以稍长一些
                return sanitized
            elif isinstance(obj, dict):
                return {
                    sanitize_input(str(k), 100): sanitize_game_data(v, max_depth - 1)
                    for k, v in obj.items()
                    if isinstance(k, (str, int, float)) and isinstance(v, (str, int, float, bool, dict, list))
                }
            elif isinstance(obj, list):
                return [sanitize_game_data(item, max_depth - 1) for item in obj[:100]]  # 限制数组长度
            elif isinstance(obj, (int, float, bool)):
                return obj
            else:
                return str(obj)[:100]  # 其他类型转为字符串并限制长度
        
        # 应用基本安全过滤
        game_data = sanitize_game_data(game_data)
            
        player_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
        
        # 获取房间信息
        game_room = None
        sync_type = None
        broadcast_data = None
        
        # 使用超时机制获取锁
        if not multiplayer_lock.acquire(timeout=1):
            logger.error(f"获取全局锁超时，无法处理状态提交请求: {room_id}, {player_ip}")
            return jsonify({'error': '服务器繁忙，请稍后重试'}), 503
            
        try:
            if room_id not in game_rooms:
                return jsonify({'error': '游戏房间不存在'}), 404
                
            game_room = game_rooms[room_id]
            
            # 验证玩家是否在房间内
            if player_ip not in game_room.players:
                return jsonify({'error': '您不在此房间内'}), 403
                
            # 只处理服务器中继模式
            if game_room.game_mode != '服务器中继':
                return jsonify({'error': 'P2P模式不支持此接口'}), 400
                
            sync_type = game_room.sync_type
            
            if sync_type == '状态同步':
                # 状态同步：保存最后一次状态
                try:
                    # 将数据序列化为字节
                    state_bytes = json.dumps(game_data, ensure_ascii=False).encode('utf-8')
                    
                    if len(state_bytes) > MAX_STATE_SIZE:
                        return jsonify({'error': f'状态数据过大，最大支持{MAX_STATE_SIZE}字节'}), 400
                    
                    game_room.last_state = state_bytes
                    
                    # 准备广播数据
                    broadcast_data = {
                        'type': 'state_sync',
                        'from': player_ip,
                        'data': game_data,
                        'timestamp': time.time()
                    }
                    
                except Exception as e:
                    return jsonify({'error': f'状态数据序列化失败: {str(e)}'}), 400
                    
            elif sync_type == '帧同步':
                # 帧同步：添加到操作队列
                if player_ip not in game_room.player_queues:
                    game_room.player_queues[player_ip] = deque(maxlen=MAX_QUEUE_SIZE)
                
                operation = {
                    'data': game_data,
                    'timestamp': time.time()
                }
                game_room.player_queues[player_ip].append(operation)
                
            else:
                # 用户自定义：准备广播
                broadcast_data = {
                    'type': 'custom_sync',
                    'from': player_ip,
                    'data': game_data,
                    'timestamp': time.time()
                }
        finally:
            multiplayer_lock.release()
        
        # 在锁外广播消息
        if broadcast_data:
            try:
                logger.info(f"广播消息到房间 {room_id}: {broadcast_data.get('type', 'unknown')}")
                socketio.emit('message', broadcast_data, room=room_id, namespace='/multiplayer')
                logger.info(f"广播成功完成")
            except Exception as e:
                logger.error(f"广播状态数据失败: {e}")
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"提交状态异常: {e}")
        return jsonify({'error': f'处理请求时出错: {str(e)}'}), 500

@app.route('/api/multiplayer/exit_room', methods=['POST'])
def exit_room():
    """退出房间"""
    try:
        data = request.get_json(force=True)
        room_id = str(data.get('room_id', '')).strip()
        
        if not room_id:
            return jsonify({'error': '房间ID不能为空'}), 400
        
        player_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
        
        # 检查房间是否存在，并获取基本信息
        room_info = None
        is_host = False
        game_room_info = None
        room_exists = False
        
        # 使用超时机制获取锁，避免无限等待
        if not multiplayer_lock.acquire(timeout=1):
            logger.error(f"获取全局锁超时，无法处理退出请求: {room_id}, {player_ip}")
            return jsonify({'error': '服务器繁忙，请稍后重试'}), 503
        
        try:
            # 先检查房间是否存在
            room_exists = room_id in multiplayer_rooms
            
            if not room_exists:
                # 房间不存在可能是因为已经被清理，这是正常的
                logger.info(f'Player {player_ip} trying to exit non-existent room {room_id} (already cleaned)')
                return jsonify({
                    'success': True,
                    'message': '房间已不存在，可能已被清理'
                })
            
            room = multiplayer_rooms[room_id]
            is_host = player_ip == room.host_ip
            
            # 如果是房主，准备销毁房间
            if is_host:
                # 复制需要的信息
                room_info = {
                    'room_id': room_id,
                    'host_ip': room.host_ip,
                    'players': []
                }
                
                # 如果有游戏房间信息，也复制一份
                if room_id in game_rooms:
                    game_room = game_rooms[room_id]
                    room_info['players'] = list(game_room.players)
                
                # 立即清理房间数据，不等待广播
                multiplayer_rooms.pop(room_id, None)
                game_rooms.pop(room_id, None)
                room_locks.pop(room_id, None)
                logger.info(f'Room destroyed by host: {room_id}')
            
            # 如果是普通玩家，从房间中移除
            elif room_id in game_rooms:
                game_room = game_rooms[room_id]
                
                if player_ip in game_room.players:
                    # 复制需要的信息
                    game_room_info = {
                        'room_id': room_id,
                        'player_ip': player_ip,
                        'remaining_players': list(game_room.players)
                    }
                    game_room_info['remaining_players'].remove(player_ip)
                    
                    # 从玩家列表中移除
                    game_room.players.remove(player_ip)
                    
                    # 清理相关数据
                    if player_ip in game_room.player_queues:
                        del game_room.player_queues[player_ip]
                    if player_ip in game_room.websocket_connections:
                        del game_room.websocket_connections[player_ip]
                    
                    # 更新房间人数
                    room.current_players = len(game_room.players)
            else:
                # 如果是普通玩家但房间不存在游戏信息，也标记为成功
                # 这种情况通常发生在房间刚创建但还没有初始化游戏信息时
                logger.info(f'Player {player_ip} exited room {room_id} (no game room info)')
                return jsonify({
                    'success': True,
                    'message': '已退出房间'
                })
        finally:
            multiplayer_lock.release()
        
        # 在锁外处理广播
        if is_host and room_info:
            # 广播房间关闭消息
            try:
                socketio.emit('message', {
                    'type': 'room_closed',
                    'message': '房主已退出，房间关闭',
                    'timestamp': time.time()
                }, room=room_id, namespace='/multiplayer')
            except Exception as e:
                logger.error(f"广播房间关闭消息失败: {e}")
        
        # 如果是普通玩家，广播离开消息
        elif game_room_info:
            try:
                socketio.emit('message', {
                    'type': 'player_left',
                    'player_ip': game_room_info['player_ip'],
                    'remaining_players': game_room_info['remaining_players'],
                    'timestamp': time.time()
                }, room=room_id, namespace='/multiplayer')
            except Exception as e:
                logger.error(f"广播玩家离开消息失败: {e}")
        
        return jsonify({
            'success': True,
            'message': '已退出房间'
        })
    except Exception as e:
        logger.error(f"退出房间异常: {e}")
        return jsonify({'error': f'处理请求时出错: {str(e)}'}), 500

# ============ WebSocket 消息接收 ============

@socketio.on('connect', namespace='/multiplayer')
def on_connect():
    """玩家连接"""
    logger.info(f'Player connected: {request.sid}, IP: {request.remote_addr}')

@socketio.on('join_room', namespace='/multiplayer')
def on_join_room(data):
    """加入房间的WebSocket连接"""
    try:
        room_id = str(data.get('room_id', '')).strip()
        player_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
        session_id = request.sid
        
        logger.info(f'WebSocket join_room请求: room_id={room_id}, player_ip={player_ip}, session_id={session_id}')
        
        # 检查房间是否存在
        if not room_id:
            logger.warning(f'WebSocket join_room: 房间ID为空, player_ip={player_ip}')
            emit('error', {'message': '房间ID不能为空'})
            return
            
        # 获取房间信息
        game_room = None
        initial_state = None
        
        # 使用超时机制获取锁
        if not multiplayer_lock.acquire(timeout=1):
            logger.error(f"获取全局锁超时，无法处理WebSocket加入请求: {room_id}, {player_ip}")
            emit('error', {'message': '服务器繁忙，请稍后重试'})
            return
            
        try:
            if room_id not in game_rooms:
                logger.warning(f'WebSocket join_room: 房间不存在 {room_id}, player_ip={player_ip}')
                emit('error', {'message': '房间不存在'})
                return
            
            game_room = game_rooms[room_id]
            
            logger.info(f'WebSocket join_room: 房间 {room_id} 中的玩家列表: {game_room.players}')
            logger.info(f'WebSocket join_room: 当前玩家IP: {player_ip}')
            
            # 更宽松的IP检查 - 考虑到可能的IP地址变化
            player_in_room = False
            matched_ip = None
            
            if player_ip in game_room.players:
                player_in_room = True
                matched_ip = player_ip
            else:
                # 尝试其他可能的IP格式
                # 检查是否是localhost/127.0.0.1的变体
                possible_ips = [player_ip]
                
                if player_ip == '127.0.0.1':
                    possible_ips.extend(['localhost', '::1'])
                elif player_ip == 'localhost':
                    possible_ips.extend(['127.0.0.1', '::1'])
                elif player_ip == '::1':
                    possible_ips.extend(['127.0.0.1', 'localhost'])
                
                # 检查是否有任何可能的IP在房间中
                for possible_ip in possible_ips:
                    if possible_ip in game_room.players:
                        player_in_room = True
                        matched_ip = possible_ip
                        logger.info(f'WebSocket join_room: IP匹配成功 {player_ip} -> {matched_ip}')
                        break
            
            if not player_in_room:
                logger.warning(f'WebSocket join_room: 玩家IP {player_ip} 不在房间 {room_id} 的玩家列表中: {game_room.players}')
                # 不直接拒绝，而是警告并继续，让玩家能够连接
                logger.info(f'WebSocket join_room: 允许连接但记录警告')
                matched_ip = player_ip  # 使用原始IP
                
            # 记录WebSocket连接，使用匹配的IP或原始IP
            game_room.websocket_connections[matched_ip] = session_id
            logger.info(f'WebSocket join_room: 记录连接 {matched_ip} -> {session_id}')
            
            # 如果是状态同步且有保存的状态，复制一份
            if game_room.sync_type == '状态同步' and game_room.last_state:
                try:
                    initial_state = game_room.last_state
                except Exception as e:
                    logger.error(f'Failed to copy initial state: {e}')
        finally:
            multiplayer_lock.release()
        
        # 第一步：加入Socket.IO房间
        logger.info(f'WebSocket join_room: 准备加入Socket.IO房间 {room_id}')
        try:
            join_room(room_id)
            logger.info(f'WebSocket join_room: join_room()调用完成')
            
            # 立即测试房间成员身份
            try:
                # 尝试获取房间信息 - 这可能不是公开API
                session_id = request.sid
                logger.info(f'WebSocket join_room: 会话ID {session_id} 已尝试加入房间 {room_id}')
                
                # 发送一个仅给自己的测试消息
                emit('room_test', {
                    'message': f'个人测试消息 - 会话 {session_id} 在房间 {room_id}',
                    'timestamp': time.time()
                })
                
            except Exception as e:
                logger.error(f'WebSocket join_room: 房间成员身份测试失败: {e}')
                
        except Exception as e:
            logger.error(f'WebSocket join_room: join_room()调用失败: {e}')
            emit('error', {'message': f'加入房间失败: {str(e)}'})
            return
        
        # 第二步：发送确认消息（直接发送给客户端）
        logger.info(f'WebSocket join_room: 发送确认消息')
        try:
            emit('message', {
                'type': 'room_joined',
                'room_id': room_id,
                'message': '成功加入房间',
                'session_id': session_id,
                'matched_ip': matched_ip,
                'timestamp': time.time()
            })
            logger.info(f'WebSocket join_room: 确认消息已发送')
        except Exception as e:
            logger.error(f'WebSocket join_room: 发送确认消息失败: {e}')
        
        # 第三步：立即测试房间广播
        logger.info(f'WebSocket join_room: 测试房间广播')
        try:
            test_broadcast_msg = {
                'type': 'join_test_broadcast',
                'message': f'测试广播：{matched_ip} 已加入房间',
                'timestamp': time.time()
            }
            socketio.emit('message', test_broadcast_msg, room=room_id, namespace='/multiplayer')
            logger.info(f'WebSocket join_room: 测试广播已发送')
        except Exception as e:
            logger.error(f'WebSocket join_room: 测试广播失败: {e}')
        
        # 如果有初始状态，发送给新玩家
        if initial_state:
            try:
                state_data = json.loads(initial_state.decode('utf-8'))
                emit('state_sync', {
                    'type': 'initial_state',
                    'data': state_data,
                    'timestamp': time.time()
                })
                logger.info(f'WebSocket join_room: 初始状态已发送')
            except Exception as e:
                logger.error(f'Failed to send initial state: {e}')
        
        logger.info(f'Player {player_ip} joined room {room_id} via WebSocket successfully')
    except Exception as e:
        logger.error(f'WebSocket join_room error: {e}')
        import traceback
        logger.error(f'WebSocket join_room traceback: {traceback.format_exc()}')
        emit('error', {'message': '加入房间失败，请重试'})

@socketio.on('disconnect', namespace='/multiplayer')
def on_disconnect():
    """玩家断开连接"""
    try:
        player_ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
        
        # 创建一个房间ID和连接ID的副本，避免在迭代过程中修改字典
        rooms_to_check = {}
        
        # 先查找玩家在哪些房间中有连接
        if not multiplayer_lock.acquire(timeout=1):
            logger.error(f"获取全局锁超时，无法处理断开连接: {player_ip}")
            return
            
        try:
            for room_id, game_room in list(game_rooms.items()):
                if player_ip in game_room.websocket_connections:
                    session_id = game_room.websocket_connections.get(player_ip)
                    if session_id == request.sid:
                        rooms_to_check[room_id] = session_id
        finally:
            multiplayer_lock.release()
        
        # 然后逐个处理断开连接
        for room_id, session_id in rooms_to_check.items():
            try:
                # 再次获取锁，处理单个房间
                if not multiplayer_lock.acquire(timeout=1):
                    logger.error(f"获取全局锁超时，无法处理房间断开连接: {room_id}, {player_ip}")
                    continue
                    
                try:
                    # 检查房间和连接是否仍然存在
                    if room_id in game_rooms and player_ip in game_rooms[room_id].websocket_connections:
                        if game_rooms[room_id].websocket_connections[player_ip] == session_id:
                            # 只删除WebSocket连接，不影响HTTP API的房间成员关系
                            del game_rooms[room_id].websocket_connections[player_ip]
                            logger.info(f'Player {player_ip} disconnected from room {room_id}')
                finally:
                    multiplayer_lock.release()
                    
                # 在锁外广播消息
                try:
                    socketio.emit('message', {
                        'type': 'player_disconnected',
                        'player_ip': player_ip,
                        'timestamp': time.time()
                    }, room=room_id, namespace='/multiplayer')
                except Exception as e:
                    logger.error(f"广播玩家断开连接消息失败: {e}")
                    
            except Exception as e:
                logger.error(f"处理玩家断开连接异常: {e}")
    except Exception as e:
        logger.error(f"处理断开连接时发生异常: {e}")

@socketio.on('trigger_broadcast', namespace='/multiplayer')
def on_trigger_broadcast(data):
    """通过WebSocket事件触发广播测试"""
    try:
        room_id = data.get('room_id', '')
        message_type = data.get('type', 'websocket_triggered')
        
        logger.info(f'收到WebSocket触发广播请求: room_id={room_id}, type={message_type}')
        
        # 准备广播消息
        broadcast_message = {
            'type': message_type,
            'message': 'WebSocket事件触发的广播',
            'timestamp': time.time(),
            'triggered_by': 'websocket_event'
        }
        
        # 直接广播（在WebSocket事件上下文中）
        socketio.emit('message', broadcast_message, room=room_id, namespace='/multiplayer')
        
        # 同时尝试帧同步消息
        if message_type == 'frame_sync_test':
            frame_data = {
                'type': 'frame_sync',
                'tick': 9999,
                'timestamp': time.time(),
                'players': {
                    '172.18.67.143': [
                        {'action': 'websocket_triggered', 'timestamp': time.time()}
                    ]
                },
                'triggered_by': 'websocket_event'
            }
            socketio.emit('message', frame_data, room=room_id, namespace='/multiplayer')
            logger.info(f'WebSocket事件触发的帧同步消息已发送: {room_id}')
        
        logger.info(f'WebSocket事件触发的广播已发送: {room_id}')
        
        # 发送确认消息给触发者
        emit('broadcast_result', {
            'success': True,
            'message': '广播已发送',
            'timestamp': time.time()
        })
        
    except Exception as e:
        logger.error(f'WebSocket触发广播失败: {e}')
        emit('broadcast_result', {
            'success': False,
            'message': f'广播失败: {str(e)}',
            'timestamp': time.time()
        })

def broadcast_to_room(room_id: str, message: dict):
    """向房间内所有玩家广播消息"""
    try:
        # 检查房间是否存在，不使用锁以避免死锁
        if room_id not in game_rooms:
            logger.warning(f"尝试向不存在的房间 {room_id} 广播消息")
            return
        
        # 使用非阻塞方式发送消息
        # 创建一个后台线程来发送消息，避免阻塞当前线程
        def send_message():
            try:
                socketio.emit('message', message, room=room_id, namespace='/multiplayer')
            except Exception as e:
                logger.error(f"广播消息到房间 {room_id} 失败: {e}")
        
        # 启动后台线程发送消息
        threading.Thread(target=send_message, daemon=True).start()
        
    except Exception as e:
        logger.error(f"广播消息到房间 {room_id} 失败: {e}")
        # 继续执行，不要因为广播失败而中断整个流程

# ============ 帧同步定时器 ============

def room_frame_sync_worker(room_id: str):
    """单个房间的帧同步工作协程 - 高精度定时版本"""
    tick_counter = 0
    logger.info(f"房间 {room_id} 帧同步协程启动 (高精度定时)")
    
    try:
        # 记录开始时间，用于精确定时
        start_time = time.time()
        next_tick_time = start_time + TICK_INTERVAL
        
        while True:
            # 检查房间是否还存在
            with multiplayer_lock:
                if room_id not in multiplayer_rooms:
                    logger.info(f"房间 {room_id} 已销毁，停止帧同步协程")
                    break
                    
                # 检查房间是否还是帧同步模式
                if room_id in game_rooms:
                    game_room = game_rooms[room_id]
                    if game_room.sync_type != "帧同步":
                        logger.info(f"房间 {room_id} 不再是帧同步模式，停止帧同步协程")
                        break
                else:
                    logger.info(f"房间 {room_id} 游戏信息不存在，停止帧同步协程")
                    break
            
            # 发送帧同步消息
            tick_counter += 1
            current_time = time.time()
            frame_data = {
                'type': 'frame_sync',
                'tick': tick_counter,
                'timestamp': current_time,
                'players': {}
            }
            
            try:
                socketio.emit('message', frame_data, room=room_id, namespace='/multiplayer')
            except Exception as e:
                logger.error(f"房间 {room_id} 发送帧同步消息失败: {e}")
            
            # 精确定时：计算到下一个tick的精确等待时间
            current_time = time.time()
            if current_time < next_tick_time:
                # 如果还没到下一个tick时间，精确等待
                sleep_time = next_tick_time - current_time
                socketio.sleep(sleep_time)
            else:
                # 如果已经超时，立即进入下一个周期（但记录警告）
                if current_time - next_tick_time > 0.001:  # 超时1ms以上才警告
                    logger.warning(f"房间 {room_id} 帧同步超时 {(current_time - next_tick_time)*1000:.1f}ms")
            
            # 更新下一个tick时间
            next_tick_time += TICK_INTERVAL
            
            # 防止累积误差：如果超时太多，重新校准
            if current_time - next_tick_time > TICK_INTERVAL:
                logger.warning(f"房间 {room_id} 帧同步严重超时，重新校准定时")
                next_tick_time = current_time + TICK_INTERVAL
            
    except Exception as e:
        logger.error(f"房间 {room_id} 帧同步协程异常: {e}")
    finally:
        # 清理任务记录
        with room_frame_sync_lock:
            if room_id in room_frame_sync_tasks:
                del room_frame_sync_tasks[room_id]
        logger.info(f"房间 {room_id} 帧同步协程已结束")

def start_room_frame_sync(room_id: str):
    """为房间启动帧同步协程"""
    with room_frame_sync_lock:
        # 如果房间已经有帧同步任务，先停止它
        if room_id in room_frame_sync_tasks:
            logger.warning(f"房间 {room_id} 已有帧同步任务，先停止旧任务")
            stop_room_frame_sync(room_id)
        
        # 启动新的帧同步任务
        try:
            task = socketio.start_background_task(room_frame_sync_worker, room_id)
            room_frame_sync_tasks[room_id] = task
            logger.info(f"房间 {room_id} 帧同步协程已启动")
            return True
        except Exception as e:
            logger.error(f"房间 {room_id} 帧同步协程启动失败: {e}")
            return False

def stop_room_frame_sync(room_id: str):
    """停止房间的帧同步协程"""
    with room_frame_sync_lock:
        if room_id in room_frame_sync_tasks:
            # 注意：Flask-SocketIO的后台任务不能直接停止
            # 协程会在检查房间状态时自然退出
            del room_frame_sync_tasks[room_id]
            logger.info(f"房间 {room_id} 帧同步协程已标记停止")
            return True
        return False

def is_room_frame_sync_active(room_id: str) -> bool:
    """检查房间是否有活跃的帧同步协程"""
    with room_frame_sync_lock:
        return room_id in room_frame_sync_tasks

# ============ 多人游戏目录支持 ============

# 多人游戏目录
MULTIPLAYER_GAMES_DIR = os.path.join(app.template_folder, "multiplayer_games")
os.makedirs(MULTIPLAYER_GAMES_DIR, exist_ok=True)

@app.route('/multiplayer_game/<game_id>/')
def multiplayer_game_page(game_id):
    """多人游戏页面"""
    games = list_multiplayer_games()
    if game_id not in games:
        return f"未知多人游戏 {game_id}", 404

    info = games[game_id]
    
    # 记录点击
    increment_click(game_id)
    
    folder_path = os.path.join(MULTIPLAYER_GAMES_DIR, game_id)
    return send_from_directory(folder_path, "index.html")

@app.route('/multiplayer_game/<game_id>/<path:filename>')
def multiplayer_game_assets(game_id, filename):
    """多人游戏静态资源"""
    folder_path = os.path.join(MULTIPLAYER_GAMES_DIR, game_id)
    if not os.path.isdir(folder_path):
        return "", 404

    full_path = os.path.join(folder_path, filename)
    if not os.path.isfile(full_path):
        return "", 404

    resp = send_from_directory(folder_path, filename)

    # Support Unity compressed builds (.br / .gz)
    if filename.endswith('.br'):
        resp.headers['Content-Encoding'] = 'br'
        resp.headers['Content-Type'] = mimetypes.guess_type(filename[:-3])[0] or 'application/octet-stream'
    elif filename.endswith('.gz'):
        resp.headers['Content-Encoding'] = 'gzip'
        resp.headers['Content-Type'] = mimetypes.guess_type(filename[:-3])[0] or 'application/octet-stream'

    return resp

def list_multiplayer_games() -> dict:
    """列出所有多人游戏"""
    games = {}
    
    if not os.path.exists(MULTIPLAYER_GAMES_DIR):
        return games
    
    try:
        for d in os.listdir(MULTIPLAYER_GAMES_DIR):
            folder_path = os.path.join(MULTIPLAYER_GAMES_DIR, d)
            if not os.path.isdir(folder_path):
                continue
            index_file = os.path.join(folder_path, "index.html")
            if not os.path.isfile(index_file):
                continue
            
            with config_lock:
                meta = game_config.get(d, {})
            
            games[d] = {
                "name": d,
                "template": f"multiplayer_games/{d}/index.html",
                "folder": True,
                "author": meta.get("author", "匿名"),
                "timestamp": meta.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                "clicks": meta.get("clicks", 0)
            }
    except Exception as e:
        logger.error(f'Error listing multiplayer games: {e}')
    
    return games

@app.route('/api/multiplayer/games', methods=['GET'])
def get_multiplayer_games():
    """获取多人游戏列表"""
    games = list_multiplayer_games()
    games_list = []
    
    for game_id, info in games.items():
        games_list.append({
            "id": game_id,
            "name": info["name"],
            "author": info["author"],
            "timestamp": info["timestamp"],
            "clicks": info["clicks"],
            "url": f"/multiplayer_game/{game_id}/"
        })
    
    return jsonify({"games": games_list})


BACKEND_BASE = 'http://172.18.67.143:8081'   # 目标后端

@app.route('/proxy/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy(subpath):
    # 1. 预检请求，直接回 OK
    if request.method == 'OPTIONS':
        resp = Response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    # 2. 构造要转发的目标 URL
    target_url = f'{BACKEND_BASE}/{subpath}'

    # 3. 整理需要透传的请求头（去掉 Host / Content-Length / Connection）
    forward_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ('host', 'content-length', 'connection')
    }

    # 4. 根据请求类型准备 body
    files = None
    data  = None
    json_ = None
    if request.method in ('POST', 'PUT', 'PATCH'):
        if request.files:                       # 文件上传
            files = {
                k: (f.filename, f.stream, f.mimetype)
                for k, f in request.files.items()
            }
            data = request.form.to_dict(flat=True)
        elif request.is_json:                   # 纯 JSON
            json_ = request.get_json(silent=True, force=True)
        else:                                   # 其他（如表单）
            data = request.get_data()

    # 5. 发起转发
    try:
        backend_resp = requests.request(
            method  = request.method,
            url     = target_url,
            params  = request.args,
            headers = forward_headers,
            data    = data,
            json    = json_,
            files   = files,
            cookies = dict(request.cookies or {}),  # 转成普通 dict，防止类型不兼容
            timeout = 10
        )
    except requests.exceptions.RequestException as e:
        # 捕获网络/连接等异常，记录并返回 502 Bad Gateway
        logger.exception('Proxy error forwarding %s %s -> %s: %s', request.method, request.full_path, target_url, e)
        return jsonify({'status': 'error', 'msg': 'backend unreachable', 'detail': str(e)}), 502

    # 如果后端返回 4xx / 5xx，记录响应内容（最多 2KB）方便排查
    if backend_resp.status_code >= 400:
        logger.warning('Backend %s %s -> %s returned %s: %s',
                       request.method,
                       request.full_path,
                       target_url,
                       backend_resp.status_code,
                       backend_resp.text[:2048])

    # 6. 构造响应并添加 CORS 头
    resp = Response(backend_resp.content, backend_resp.status_code)
    for h, v in backend_resp.headers.items():
        if h.lower() not in ('content-encoding', 'transfer-encoding'):
            resp.headers[h] = v
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


# Serve generic files directly under templates/games (e.g., default preview)
@app.route('/games/<path:filename>')
def games_root_assets(filename):
    return send_from_directory(BUILTIN_GAMES_DIR, filename)


# ---------------- IP -> Name persistence ----------------
NAME_FILE = 'user_names.json'
name_lock = threading.Lock()

def load_names():
    with app.app_context():
        rows = UserName.query.all()
    if rows:
        return {r.ip: r.name for r in rows}

    # Fallback to JSON once for migration
    if os.path.exists(NAME_FILE):
        try:
            with open(NAME_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    with app.app_context():
                        for ip, nm in data.items():
                            db.session.merge(UserName(ip=ip, name=nm))
                        db.session.commit()
                    return data
        except Exception:
            pass
    return {}

ip_to_name: dict[str, str] = load_names()


def save_names():
    with app.app_context():
        for ip, nm in ip_to_name.items():
            row = UserName.query.get(ip) or UserName(ip=ip)
            row.name = nm
            db.session.merge(row)
        db.session.commit()


@app.route('/username', methods=['GET', 'POST'])
def username_api():
    """GET 返回当前 IP 的昵称；POST 提交 {name:"<昵称>"} 保存"""
    ip = request.remote_addr or 'unknown'
    
    if request.method == 'GET':
        # 调用统一的服务层逻辑
        result = service_get_user_name(ip)
        return jsonify({'name': result.name})
    
    # POST
    data = request.get_json(force=True, silent=True) or {}
    new_name = str(data.get('name', '')).strip()
    
    # 调用统一的服务层逻辑
    result = service_set_user_name(ip, new_name)
    
    if not result.success:
        return jsonify({'status': 'error', 'msg': result.error_msg}), 400
    
    return jsonify({'status': 'ok', 'name': result.name})


# ---------------- Logging setup ----------------
# --- Logging setup (absolute path & robust handler) ---
# Use absolute path to avoid CWD changes breaking logging
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

# Access logger (using FileHandler to avoid Windows file locking issues)
access_handler = logging.FileHandler(
    filename=os.path.join(LOG_DIR, 'access.log'),
    encoding='utf-8',
    delay=True
)
access_handler.setFormatter(logging.Formatter(
    fmt='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))

# Error logger (using FileHandler to avoid Windows file locking issues)
error_handler = logging.FileHandler(
    filename=os.path.join(LOG_DIR, 'error.log'),
    encoding='utf-8',
    delay=True
)
error_handler.setFormatter(logging.Formatter(
    fmt='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))
error_handler.setLevel(logging.ERROR)

# Root logger config
logger = logging.getLogger('gameplatform')
logger.setLevel(logging.INFO)
logger.addHandler(access_handler)
logger.addHandler(error_handler)

# Also hook Flask's default logger to error file
app.logger.addHandler(error_handler)

# Prevent double logging to root handlers if any
logger.propagate = False


# ---------- Request logging ----------

@app.before_request
def start_timer():
    g._start_time = time.time()


@app.after_request
def log_request(response):
    try:
        latency = (time.time() - getattr(g, '_start_time', time.time())) * 1000  # ms
        path = request.path

        # ---------- Preview aggregation ----------
        is_preview = (
            (path.startswith('/game/') and '/preview.' in path) or
            (path.startswith('/games/') and path.endswith(('preview.png', 'preview.jpg', 'preview.jpeg', 'preview.gif')))
        )

        if is_preview:
            now_ts = time.time()
            with preview_lock:
                entry = preview_agg.setdefault(request.remote_addr or 'unknown', {'start': now_ts, 'count': 0})
                entry['count'] += 1
                # 如果超出窗口或达到 30 张，输出一次汇总
                if now_ts - entry['start'] > PREVIEW_WINDOW_SECONDS or entry['count'] >= 30:
                    logger.info('%s requested %d preview images', request.remote_addr or 'unknown', entry['count'])
                    preview_agg.pop(request.remote_addr or 'unknown', None)
            # 对单个 preview 不再记录 access 行
        else:
            # 构建基础日志信息
            base_log = f'{request.remote_addr} {request.method} {request.full_path.rstrip("?")} {response.status_code} {latency:.2f}ms "{(request.headers.get("User-Agent", "") or "")[:128]}"'
            
            # 对于POST/PUT/PATCH请求，记录请求体内容
            if request.method in ('POST', 'PUT', 'PATCH'):
                request_data = ""
                try:
                    # 检查Content-Type来决定如何处理数据
                    content_type = request.headers.get('Content-Type', '').lower()
                    
                    if 'multipart/form-data' in content_type:
                        # 文件上传请求，只记录表单字段，不记录文件内容
                        form_data = {}
                        for key in request.form.keys():
                            form_data[key] = request.form.get(key)
                        
                        file_info = {}
                        for key in request.files.keys():
                            file = request.files[key]
                            if file and file.filename:
                                file_info[key] = f"<file: {file.filename}, size: {len(file.read()) if hasattr(file, 'read') else 'unknown'}>"
                                # 重置文件指针（如果可能）
                                try:
                                    file.seek(0)
                                except:
                                    pass
                        
                        upload_data = {}
                        if form_data:
                            upload_data['form'] = form_data
                        if file_info:
                            upload_data['files'] = file_info
                        
                        if upload_data:
                            request_data = f" DATA: {json.dumps(upload_data, ensure_ascii=False)}"
                    
                    elif 'application/json' in content_type:
                        # JSON数据
                        try:
                            json_data = request.get_json(force=True, silent=True)
                            if json_data:
                                # 过滤敏感字段
                                filtered_data = filter_sensitive_data(json_data)
                                data_str = json.dumps(filtered_data, ensure_ascii=False)
                                # 限制长度
                                if len(data_str) > 1000:
                                    data_str = data_str[:1000] + "...[truncated]"
                                request_data = f" DATA: {data_str}"
                        except:
                            # 如果JSON解析失败，尝试获取原始数据
                            raw_data = request.get_data(as_text=True)[:500]  # 限制500字符
                            if raw_data:
                                request_data = f" RAW_DATA: {raw_data}"
                    
                    elif 'application/x-www-form-urlencoded' in content_type:
                        # 表单数据
                        form_data = {}
                        for key in request.form.keys():
                            value = request.form.get(key)
                            # 过滤敏感字段
                            if key.lower() in ('password', 'pwd', 'pass', 'token', 'secret'):
                                form_data[key] = "[FILTERED]"
                            else:
                                form_data[key] = value[:200] if len(str(value)) > 200 else value  # 限制长度
                        
                        if form_data:
                            request_data = f" FORM: {json.dumps(form_data, ensure_ascii=False)}"
                    
                    else:
                        # 其他类型的数据，获取原始内容（限制大小）
                        raw_data = request.get_data(as_text=True)
                        if raw_data:
                            if len(raw_data) > 500:
                                request_data = f" RAW_DATA: {raw_data[:500]}...[truncated]"
                            else:
                                request_data = f" RAW_DATA: {raw_data}"
                
                except Exception as e:
                    request_data = f" [DATA_READ_ERROR: {str(e)}]"
                
                # 记录完整的POST请求信息
                logger.info(base_log + request_data)
            else:
                # 非POST请求，记录基础信息
                logger.info(base_log)

        status = response.status_code
        ip = request.remote_addr or 'unknown'
        # ---- Blacklist策略 ----
        # 1) 服务器 5xx 错误直接封禁
        # 2) 403（越权）直接封禁
        # 3) 其它 4xx 记录，如果 60秒内累计达到阈值再封禁
        if status >= 500 or status == 403:
            add_to_blacklist(ip)
        elif 400 <= status < 500:
            now_ts = time.time()
            with error_lock:
                lst = ip_error_times.setdefault(ip, [])
                lst.append(now_ts)
                # 清理旧记录
                lst[:] = [t for t in lst if now_ts - t < ERROR_WINDOW_SECONDS]
                if len(lst) >= ERROR_THRESHOLD:
                    add_to_blacklist(ip)
                    lst.clear()
    except Exception:
        app.logger.exception('Failed to log request')
    return response


def filter_sensitive_data(data):
    """过滤敏感数据，返回副本"""
    if isinstance(data, dict):
        filtered = {}
        for key, value in data.items():
            key_lower = key.lower()
            if key_lower in ('password', 'pwd', 'pass', 'token', 'secret', 'key', 'auth'):
                filtered[key] = "[FILTERED]"
            elif isinstance(value, (dict, list)):
                filtered[key] = filter_sensitive_data(value)
            else:
                # 限制字符串长度
                if isinstance(value, str) and len(value) > 200:
                    filtered[key] = value[:200] + "...[truncated]"
                else:
                    filtered[key] = value
        return filtered
    elif isinstance(data, list):
        return [filter_sensitive_data(item) for item in data]
    else:
        return data


# Global exception capture to error logger
@app.errorhandler(Exception)
def handle_exception(e):
    # Allow normal handling of HTTP (4xx / 3xx) exceptions such as 404, 405, etc.
    if isinstance(e, HTTPException):
        # Record at warning level but preserve original response & status code
        logger.warning('HTTP %s on %s %s', e.code, request.method, request.path)
        # ---- Blacklist: only 403 triggers即时封禁 ----
        if e.code == 403:
            add_to_blacklist(request.remote_addr or 'unknown')
        return e

    # Non-HTTP errors are treated as 500
    app.logger.exception('Unhandled Server Exception', exc_info=e)
    # ---- Blacklist on server error (5xx) ----
    add_to_blacklist(request.remote_addr or 'unknown')
    return jsonify({'status': 'error', 'msg': 'internal error'}), 500


# ---------------- 通用排行榜接口 ----------------

@app.route('/scores', methods=['GET', 'POST'])
def scores_api():
    """通用排行榜接口

    GET  /scores?game=<id>&difficulty=<easy|medium|hard>
        -> 返回该游戏该难度前 100 名成绩 `[{name, score}, ...]`

    POST /scores   JSON {game, difficulty, name, score}
        -> 写入/更新成绩，返回 {status:'ok'}

    为向后兼容，若缺少 game/difficulty，则分别默认 'balloon' / 'medium'。
    """

    if request.method == 'GET':
        game_id = (request.args.get('game') or 'balloon').strip()
        difficulty = (request.args.get('difficulty') or 'medium').lower()
        
        # 调用统一的服务层逻辑
        scores_list = service_get_single_difficulty_scores(game_id, difficulty, limit=100)
        return jsonify(scores_list)

    # POST
    data = request.get_json(force=True, silent=True) or {}
    game_id = str(data.get('game', 'balloon')).strip() or 'balloon'
    difficulty = str(data.get('difficulty', 'medium')).lower()
    player_name = str(data.get('name', '')).strip() or '匿名玩家'
    score_val = data.get('score', 0)

    # 调用统一的服务层逻辑
    result = service_submit_score(game_id, difficulty, player_name, score_val)
    
    if not result.success:
        return jsonify({'status': 'error', 'msg': result.error_msg}), 400

    return jsonify({'status': 'ok'})


# ---------------- IP Blacklist ----------------
# No longer using JSON; keep lock for in-memory cache consistency
blacklist_lock = threading.Lock()

TEMP_BAN_SECONDS = 300  # 5 minutes

def load_blacklist() -> dict:
    """Return dict[ip] = last_offense_ts (datetime)."""
    result = {}
    with app.app_context():
        rows = IPBlacklist.query.all()
        for r in rows:
            try:
                result[r.ip] = datetime.strptime(r.timestamp, "%Y-%m-%d %H:%M:%S")
            except Exception:
                # if parse fails, treat as now-epoch to unblock soon
                result[r.ip] = datetime.min
    return result

blacklisted_ips: dict[str, datetime] = load_blacklist()

def add_to_blacklist(ip: str):
    """Register/refresh a 5-minute temp ban for this IP and persist timestamp to DB."""
    if not ip:
        return
    now_dt = datetime.now()
    with blacklist_lock:
        blacklisted_ips[ip] = now_dt

    try:
        with app.app_context():
            row = IPBlacklist.query.get(ip)
            if row:
                row.timestamp = now_dt.strftime("%Y-%m-%d %H:%M:%S")
            else:
                db.session.add(IPBlacklist(ip=ip, timestamp=now_dt.strftime("%Y-%m-%d %H:%M:%S")))
            db.session.commit()
    except Exception as exc:
        logger.exception('Failed to persist blacklist IP %s: %s', ip, exc)
    logger.warning('IP %s temp-banned until %s', ip, (now_dt + timedelta(seconds=TEMP_BAN_SECONDS)).strftime("%H:%M:%S"))

# Block any IP that has been blacklisted earlier
# This function **must** be registered before other before_request functions like start_timer.
# Flask executes them in the order of declaration, so place it here to short-circuit ASAP.
@app.before_request
def block_blacklisted():
    # ===== 黑名单机制已临时停用 =====
    # 直接放行所有请求，不再检查 IP 是否在黑名单。
    # 如果未来需要恢复黑名单功能，可还原此处逻辑。
    # NOTE: Flask 的 before_request 钩子需要返回 None 才会继续处理请求。
    return None  # 放行


# ---- Preview request aggregation (optional log merge) ----
PREVIEW_WINDOW_SECONDS = 2        # 聚合窗口；连续 2 秒内的 preview 请求合并
preview_lock = threading.Lock()
# ip -> {start: float, count: int}
preview_agg: dict[str, dict] = defaultdict(dict)

# ---- Error burst detection for blacklist ----
ERROR_THRESHOLD = 5          # 4xx 次数
ERROR_WINDOW_SECONDS = 60    # 窗口秒数
error_lock = threading.Lock()
ip_error_times: dict[str, list[float]] = defaultdict(list)


# ---------------- Vue API Routes ----------------
# JSON API endpoints for Vue frontend

@app.route('/api/games', methods=['GET'])
def api_get_games():
    """Get all games in JSON format for Vue frontend."""
    all_games = list_games()
    
    # Fetch games with scores info
    with app.app_context():
        games_with_scores = {gid for (gid,) in db.session.query(Score.game_id).distinct().all()}
    
    games_list = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    for gid, game_info in all_games.items():
        with config_lock:
            meta = game_config.get(gid, {})
        
        # Determine preview image URL
        preview_url = "/games/preview.png"
        if game_info.get("folder"):
            for ext in ("png", "jpg", "jpeg", "gif"):
                cand_path = os.path.join(app.template_folder, "games", gid, f"preview.{ext}")
                if os.path.isfile(cand_path):
                    preview_url = f"/game/{gid}/preview.{ext}"
                    break
        
        game_data = {
            "id": gid,
            "title": game_info.get("name", gid),
            "description": f"Game by {meta.get('author', '匿名')}",
            "category": "action",  # Default category, can be enhanced later
            "preview": preview_url,
            "author": meta.get("author", "匿名"),
            "timestamp": meta.get("timestamp", now_str),
            "clicks": meta.get("clicks", 0),
            "hasLeaderboard": gid in games_with_scores,
            "isUserUploaded": bool(meta.get("ip")),
            "isExternal": meta.get("external", False),
            "link": meta.get("link", ""),
            "controls": "Use keyboard and mouse to play.",  # Default controls
            **get_game_config(gid)  # Add game configuration (maxPlayers, minPlayers, gameType)
        }
        games_list.append(game_data)
    
    return jsonify({"games": games_list})


@app.route('/api/games/featured', methods=['GET'])
def api_get_featured_games():
    """Get featured games (top 10 by clicks) for Vue homepage carousel."""
    all_games = list_games()
    
    
    # Get top games by clicks
    ranking = []
    with config_lock:
        for gid, info in all_games.items():
            meta = game_config.get(gid, {})
            ranking.append({
                "id": gid,
                "clicks": meta.get("clicks", 0),
                "info": info,
                "meta": meta
            })
    
    ranking.sort(key=lambda x: x["clicks"], reverse=True)
    featured_games = []
    
    for item in ranking[:10]:  # Top 10 featured games for carousel
        gid = item["id"]
        info = item["info"]
        meta = item["meta"]
        
        # Determine preview image URL
        preview_url = "/games/preview.png"
        if info.get("folder"):
            for ext in ("png", "jpg", "jpeg", "gif"):
                cand_path = os.path.join(app.template_folder, "games", gid, f"preview.{ext}")
                if os.path.isfile(cand_path):
                    preview_url = f"/game/{gid}/preview.{ext}"
                    break
        
        game_data = {
            "id": gid,
            "title": info.get("name", gid),
            "description": f"Game by {meta.get('author', '匿名')}",
            "category": "action",
            "preview": preview_url,
            "author": meta.get("author", "匿名"),
            "clicks": meta.get("clicks", 0)
        }
        featured_games.append(game_data)
    
    return jsonify({"games": featured_games})


@app.route('/api/games/recent', methods=['GET'])
def api_get_recent_games():
    """Get recent games (top 10 by upload time) for Vue homepage carousel."""
    all_games = list_games()
    
    # Get games sorted by timestamp (most recent first)
    recent_ranking = []
    with config_lock:
        for gid, info in all_games.items():
            meta = game_config.get(gid, {})
            timestamp_str = meta.get("timestamp", "1970-01-01 00:00:00")
            try:
                timestamp_dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except Exception:
                # If timestamp parsing fails, use epoch time
                timestamp_dt = datetime(1970, 1, 1)
            
            recent_ranking.append({
                "id": gid,
                "timestamp": timestamp_dt,
                "info": info,
                "meta": meta
            })
    
    recent_ranking.sort(key=lambda x: x["timestamp"], reverse=True)
    recent_games = []
    
    for item in recent_ranking[:10]:  # Top 10 recent games for carousel
        gid = item["id"]
        info = item["info"]
        meta = item["meta"]
        
        # Determine preview image URL
        preview_url = "/games/preview.png"
        if info.get("folder"):
            for ext in ("png", "jpg", "jpeg", "gif"):
                cand_path = os.path.join(app.template_folder, "games", gid, f"preview.{ext}")
                if os.path.isfile(cand_path):
                    preview_url = f"/game/{gid}/preview.{ext}"
                    break
        
        game_data = {
            "id": gid,
            "title": info.get("name", gid),
            "description": f"Game by {meta.get('author', '匿名')}",
            "category": "action",
            "preview": preview_url,
            "author": meta.get("author", "匿名"),
            "timestamp": meta.get("timestamp", "1970-01-01 00:00:00")
        }
        recent_games.append(game_data)
    
    return jsonify({"games": recent_games})


@app.route('/api/games/<game_id>', methods=['GET'])
def api_get_game_detail(game_id):
    """Get detailed information about a specific game."""
    all_games = list_games()
    
    if game_id not in all_games:
        return jsonify({"error": "Game not found"}), 404
    
    game_info = all_games[game_id]
    with config_lock:
        meta = game_config.get(game_id, {})
    
    # Determine preview image URL
    preview_url = "/games/preview.png"
    if game_info.get("folder"):
        for ext in ("png", "jpg", "jpeg", "gif"):
            cand_path = os.path.join(app.template_folder, "games", game_id, f"preview.{ext}")
            if os.path.isfile(cand_path):
                preview_url = f"/game/{game_id}/preview.{ext}"
                break
    
    # Check if game has leaderboard
    with app.app_context():
        has_leaderboard = bool(Score.query.filter_by(game_id=game_id).first())
    
    game_data = {
        "id": game_id,
        "title": game_info.get("name", game_id),
        "description": f"Game by {meta.get('author', '匿名')}",
        "category": "action",
        "preview": preview_url,
        "author": meta.get("author", "匿名"),
        "timestamp": meta.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        "clicks": meta.get("clicks", 0),
        "hasLeaderboard": has_leaderboard,
        "isUserUploaded": bool(meta.get("ip")),
        "isExternal": meta.get("external", False),
        "link": meta.get("link", ""),
        "controls": "Use keyboard and mouse to play.",
        "gameUrl": f"/game/{game_id}/" if game_info.get("folder") else f"/game/{game_id}"
    }
    
    return jsonify({"game": game_data})


@app.route('/api/games/upload', methods=['POST'])
def api_upload_game():
    """API endpoint for Vue game upload."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Get additional form data
    game_id = request.form.get('gameId', '').strip()
    author_name = request.form.get('author', '').strip() or '匿名'
    upload_type = request.form.get('type', 'zip')  # 'zip', 'html', or 'link'
    
    if upload_type == 'zip':
        # Handle ZIP upload
        if not file.filename.lower().endswith('.zip'):
            return jsonify({"error": "File must be a .zip file"}), 400
        
        if not game_id or not game_id.isalnum():
            return jsonify({"error": "Game ID must be alphanumeric"}), 400
        
        game_id = game_id.lower()
        uploader_ip = request.remote_addr or "unknown"
        
        if game_id in BASE_GAMES:
            return jsonify({"error": "Cannot overwrite official games"}), 403
        
        dest_dir = os.path.join(BUILTIN_GAMES_DIR, game_id)
        
        with config_lock:
            owner_ip = game_config.get(game_id, {}).get('ip', '')
            if os.path.exists(dest_dir) and owner_ip and owner_ip != uploader_ip:
                return jsonify({"error": "Game already exists and you are not the author"}), 403
            
            # Remove existing folder to overwrite
            if os.path.exists(dest_dir):
                shutil.rmtree(dest_dir)
            
            os.makedirs(dest_dir, exist_ok=True)
        
        tmp_path = dest_dir + '.zip'
        file.save(tmp_path)
        
        try:
            with zipfile.ZipFile(tmp_path, 'r') as zf:
                safe_extract(zf, dest_dir)
        except Exception as e:
            shutil.rmtree(dest_dir, ignore_errors=True)
            os.remove(tmp_path)
            return jsonify({"error": f"Extraction failed: {str(e)}"}), 400
        
        os.remove(tmp_path)
        
        # Handle single subfolder extraction
        try:
            entries = os.listdir(dest_dir)
            if len(entries) == 1 and os.path.isdir(os.path.join(dest_dir, entries[0])):
                inner_dir = os.path.join(dest_dir, entries[0])
                for item in os.listdir(inner_dir):
                    shutil.move(os.path.join(inner_dir, item), dest_dir)
                shutil.rmtree(inner_dir)
        except Exception:
            pass
        
        if not os.path.isfile(os.path.join(dest_dir, 'index.html')):
            shutil.rmtree(dest_dir, ignore_errors=True)
            return jsonify({"error": "ZIP file must contain index.html"}), 400
        
        # Update metadata
        with config_lock:
            meta = game_config.get(game_id, {})
            meta.update({
                "ip": uploader_ip,
                "author": author_name,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "clicks": meta.get("clicks", 0),
            })
            game_config[game_id] = meta
            save_game_config()
        
        return jsonify({"success": True, "gameId": game_id, "message": "Game uploaded successfully"})
    
    elif upload_type == 'html':
        # Handle single HTML file upload
        if not file.filename.lower().endswith('.html'):
            return jsonify({"error": "File must be an .html file"}), 400
        
        filename = werkzeug.utils.secure_filename(file.filename)
        game_id = os.path.splitext(filename)[0]
        uploader_ip = request.remote_addr or "unknown"
        
        dest_dir = os.path.join(BUILTIN_GAMES_DIR, game_id)
        
        with config_lock:
            owner_ip = game_config.get(game_id, {}).get("ip", "")
            if os.path.exists(dest_dir) and owner_ip and owner_ip != uploader_ip:
                return jsonify({"error": "Game already exists and you are not the author"}), 403
            
            # Recreate folder (overwrite)
            if os.path.exists(dest_dir):
                shutil.rmtree(dest_dir)
            os.makedirs(dest_dir, exist_ok=True)
            
            # Save uploaded html as index.html inside folder
            file.save(os.path.join(dest_dir, "index.html"))
            
            # Record / update metadata
            meta = game_config.get(game_id, {})
            meta.update({
                "ip": uploader_ip,
                "author": author_name,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "clicks": meta.get("clicks", 0),
            })
            game_config[game_id] = meta
            save_game_config()
        
        return jsonify({"success": True, "gameId": game_id, "message": "Game uploaded successfully"})
    
    return jsonify({"error": "Invalid upload type"}), 400


@app.route('/api/leaderboard/<game_id>', methods=['GET'])
def api_get_leaderboard(game_id):
    """Get leaderboard data for a specific game in JSON format."""
    # 调用统一的服务层逻辑
    leaderboard_data = service_get_leaderboard(game_id, limit=50)
    
    if leaderboard_data is None:
        return jsonify({"error": "Game not found or no scores available"}), 404
    
    return jsonify({
        "gameId": game_id,
        "leaderboard": leaderboard_data
    })


@app.route('/api/scores/submit', methods=['POST'])
def api_submit_score():
    """Submit score API endpoint for Vue frontend."""
    data = request.get_json(force=True)
    
    # 提取参数（Vue API 使用不同的参数名）
    game_id = str(data.get("gameId", "")).strip()
    difficulty = str(data.get("difficulty", "medium")).lower()
    player_name = str(data.get("playerName", "")).strip() or "匿名玩家"
    score_val = data.get("score", 0)

    # 调用统一的服务层逻辑
    result = service_submit_score(game_id, difficulty, player_name, score_val)
    
    if not result.success:
        return jsonify({"error": result.error_msg}), 400

    # 返回 Vue API 格式
    return jsonify({
        "success": True,
        "rank": result.rank,
        "total": result.total,
        "percent": result.percent,
        "difficulty": result.difficulty,
        "gameId": result.game_id
    })


@app.route('/api/user/name', methods=['GET', 'POST'])
def api_user_name():
    """Get/Set user nickname API for Vue frontend."""
    ip = request.remote_addr or 'unknown'
    
    if request.method == 'GET':
        # 调用统一的服务层逻辑
        result = service_get_user_name(ip)
        return jsonify({'name': result.name})
    
    # POST
    data = request.get_json(force=True, silent=True) or {}
    new_name = str(data.get('name', '')).strip()
    
    # 调用统一的服务层逻辑
    result = service_set_user_name(ip, new_name)
    
    if not result.success:
        return jsonify({'error': result.error_msg}), 400
    
    return jsonify({'success': True, 'name': result.name})





# Vue.js static files serving (should be at the end to not interfere with other routes)
@app.route('/vite.svg')
def vue_vite_svg():
    """Serve Vue.js vite.svg file."""
    return send_from_directory(VUE_BUILD_DIR, 'vite.svg')

@app.route('/favicon.ico')
def vue_favicon():
    """Serve Vue.js favicon if it exists."""
    favicon_path = os.path.join(VUE_BUILD_DIR, 'favicon.ico')
    if os.path.isfile(favicon_path):
        return send_from_directory(VUE_BUILD_DIR, 'favicon.ico')
    # Fallback to default Flask behavior
    from flask import abort
    abort(404)

# Vue.js SPA catch-all route (must be last to handle client-side routing)
@app.route('/<path:path>')
def vue_catch_all(path):
    """Handle Vue.js client-side routing by serving index.html for unknown routes."""
    # Only handle routes that look like Vue routes (no file extension)
    if '.' not in path and not path.startswith('api/') and not path.startswith('game/') and not path.startswith('upload') and not path.startswith('submit') and not path.startswith('leaderboard/') and not path.startswith('rooms') and not path.startswith('proxy/') and not path.startswith('games/') and not path.startswith('username') and not path.startswith('scores'):
        return send_from_directory(VUE_BUILD_DIR, 'index.html')
    # For other paths, return 404
    from flask import abort
    abort(404)


# ---------------- 服务层 - 统一的业务逻辑 ----------------
# 将重复的业务逻辑抽取到统一的服务层函数，供不同接口调用

class ScoreSubmissionResult:
    """分数提交结果"""
    def __init__(self, success: bool, rank: int = 0, total: int = 0, percent: float = 0.0, 
                 difficulty: str = "", game_id: str = "", error_msg: str = ""):
        self.success = success
        self.rank = rank
        self.total = total
        self.percent = percent
        self.difficulty = difficulty
        self.game_id = game_id
        self.error_msg = error_msg

def service_submit_score(game_id: str, difficulty: str, player_name: str, score: int) -> ScoreSubmissionResult:
    """
    统一的分数提交业务逻辑
    
    Args:
        game_id: 游戏ID
        difficulty: 难度 (easy/medium/hard)
        player_name: 玩家名称
        score: 分数
    
    Returns:
        ScoreSubmissionResult: 包含提交结果的对象
    """
    # 验证参数
    if not game_id:
        return ScoreSubmissionResult(False, error_msg="missing game id")
    
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"
    
    if not player_name:
        player_name = "匿名玩家"
    
    player_name = player_name[:32]  # 限制长度
    
    try:
        score = int(score)
    except (TypeError, ValueError):
        return ScoreSubmissionResult(False, error_msg="invalid score")
    
    # 更新分数到数据库
    with app.app_context():
        row = Score.query.filter_by(game_id=game_id, difficulty=difficulty, player_name=player_name).first()
        if row:
            if score > row.score:
                logger.info('Score improved: %s %s %s from %s to %s', game_id, difficulty, player_name, row.score, score)
                row.score = score
            else:
                logger.info('Score not improved: %s %s %s stays at %s', game_id, difficulty, player_name, row.score)
        else:
            logger.info('New score: %s %s %s => %s', game_id, difficulty, player_name, score)
            db.session.add(Score(game_id=game_id, difficulty=difficulty, player_name=player_name, score=score))

        db.session.commit()

        # 计算排名
        higher_cnt = Score.query.filter_by(game_id=game_id, difficulty=difficulty).filter(Score.score > score).count()
        total_cnt = Score.query.filter_by(game_id=game_id, difficulty=difficulty).count()

    rank = higher_cnt + 1
    percent = round((total_cnt - rank) / total_cnt * 100, 2) if total_cnt else 0

    return ScoreSubmissionResult(
        success=True,
        rank=rank,
        total=total_cnt,
        percent=percent,
        difficulty=difficulty,
        game_id=game_id
    )

def service_get_leaderboard(game_id: str, limit: int = 50) -> dict:
    """
    统一的排行榜查询业务逻辑
    
    Args:
        game_id: 游戏ID
        limit: 返回的排行榜记录数量限制
    
    Returns:
        dict: 包含排行榜数据的字典，格式为 {difficulty: [{"name": str, "score": int}]}
        如果游戏不存在，返回 None
    """
    with app.app_context():
        # 检查游戏是否存在（是否有任何分数记录）
        exists = Score.query.filter_by(game_id=game_id).first()
        if not exists:
            return None
        
        leaderboard_data = {}
        for diff in ("easy", "medium", "hard"):
            rows = (Score.query.filter_by(game_id=game_id, difficulty=diff)
                             .order_by(Score.score.desc())
                             .limit(limit)
                             .all())
            leaderboard_data[diff] = [{"name": r.player_name, "score": r.score} for r in rows]
    
    return leaderboard_data

class UserNameResult:
    """用户名操作结果"""
    def __init__(self, success: bool, name: str = "", error_msg: str = ""):
        self.success = success
        self.name = name
        self.error_msg = error_msg

def service_get_user_name(ip: str) -> UserNameResult:
    """
    统一的获取用户名业务逻辑
    
    Args:
        ip: 用户IP地址
    
    Returns:
        UserNameResult: 包含用户名的结果对象
    """
    with name_lock:
        name = ip_to_name.get(ip, '匿名')
        return UserNameResult(success=True, name=name)

def service_set_user_name(ip: str, new_name: str) -> UserNameResult:
    """
    统一的设置用户名业务逻辑
    
    Args:
        ip: 用户IP地址
        new_name: 新的用户名
    
    Returns:
        UserNameResult: 包含操作结果的对象
    """
    new_name = str(new_name).strip()[:32]
    if not new_name:
        return UserNameResult(success=False, error_msg="invalid name")
    
    with name_lock:
        ip_to_name[ip] = new_name
        save_names()
    
    return UserNameResult(success=True, name=new_name)



def service_get_single_difficulty_scores(game_id: str, difficulty: str, limit: int = 100) -> list:
    """
    统一的单一难度分数查询业务逻辑
    
    Args:
        game_id: 游戏ID
        difficulty: 难度 (easy/medium/hard)
        limit: 返回的记录数量限制
    
    Returns:
        list: 分数列表，格式为 [{"name": str, "score": int}]
    """
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"
    
    with app.app_context():
        rows = (Score.query.filter_by(game_id=game_id, difficulty=difficulty)
                           .order_by(Score.score.desc())
                           .limit(limit)
                           .all())
        return [{'name': r.player_name, 'score': r.score} for r in rows]

@app.route('/api/multiplayer/test_broadcast', methods=['POST'])
def test_broadcast():
    """手动测试广播功能"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    # 发送测试消息
    test_message = {
        'type': 'test_broadcast',
        'message': '这是一个测试广播消息',
        'timestamp': time.time()
    }
    
    try:
        logger.info(f"手动发送测试广播到房间 {room_id}: {test_message}")
        
        # 确保在Flask应用上下文中进行广播
        with app.app_context():
            socketio.emit('message', test_message, room=room_id, namespace='/multiplayer')
        
        logger.info(f"测试广播发送完成: {room_id}")
        
        return jsonify({'success': True, 'message': '测试广播已发送'})
    except Exception as e:
        logger.error(f"测试广播失败: {e}")
        import traceback
        logger.error(f"测试广播traceback: {traceback.format_exc()}")
        return jsonify({'error': f'广播失败: {str(e)}'}), 500

@app.route('/api/multiplayer/test_frame_sync', methods=['POST'])
def test_frame_sync():
    """手动测试帧同步消息"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    # 构建帧同步消息
    frame_data = {
        'type': 'frame_sync',
        'tick': 999,
        'timestamp': time.time(),
        'players': {
            '172.18.67.143': [
                {'action': 'test_manual', 'timestamp': time.time()}
            ]
        }
    }
    
    try:
        logger.info(f"手动发送帧同步消息到房间 {room_id}: {frame_data}")
        
        # 确保在Flask应用上下文中进行广播
        with app.app_context():
            socketio.emit('message', frame_data, room=room_id, namespace='/multiplayer')
        
        logger.info(f"手动帧同步消息发送完成: {room_id}")
        
        return jsonify({'success': True, 'message': '手动帧同步消息已发送'})
    except Exception as e:
        logger.error(f"手动帧同步消息失败: {e}")
        import traceback
        logger.error(f"手动帧同步traceback: {traceback.format_exc()}")
        return jsonify({'error': f'发送失败: {str(e)}'}), 500

@app.route('/api/multiplayer/check_room_members', methods=['POST'])
def check_room_members():
    """检查Socket.IO房间成员"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    try:
        # 尝试获取房间成员信息
        # 这可能需要使用内部API或其他方法
        
        # 检查我们自己记录的连接
        websocket_connections = {}
        if room_id in game_rooms:
            websocket_connections = game_rooms[room_id].websocket_connections.copy()
        
        # 尝试通过socketio获取房间信息
        try:
            # Flask-SocketIO可能有内部方法来获取房间成员
            # 但这些API可能不是公开的
            room_info = {
                'room_id': room_id,
                'websocket_connections': websocket_connections,
                'connections_count': len(websocket_connections)
            }
        except Exception as e:
            room_info = {
                'room_id': room_id,
                'websocket_connections': websocket_connections,
                'connections_count': len(websocket_connections),
                'error': str(e)
            }
        
        logger.info(f"房间成员检查: {room_id} -> {room_info}")
        
        return jsonify({
            'success': True,
            'room_info': room_info
        })
        
    except Exception as e:
        logger.error(f"检查房间成员失败: {e}")
        return jsonify({'error': f'检查失败: {str(e)}'}), 500

@app.route('/api/multiplayer/test_simple_frame_sync', methods=['POST'])
def test_simple_frame_sync():
    """测试帧同步功能"""
    data = request.get_json(force=True)
    room_id = str(data.get('room_id', '')).strip()
    
    if not room_id:
        return jsonify({'error': '房间ID不能为空'}), 400
    
    try:
        # 检查房间是否有活跃的帧同步协程
        with room_frame_sync_lock:
            is_in_sync_list = room_id in room_frame_sync_tasks
            sync_rooms_count = len(room_frame_sync_tasks)
            sync_rooms_list = list(room_frame_sync_tasks.keys())
        
        # 手动发送一个帧同步消息
        frame_data = {
            'type': 'frame_sync',
            'tick': 999,
            'timestamp': time.time(),
            'players': {},
            'test': True,
            'message': '手动帧同步测试消息'
        }
        
        socketio.emit('message', frame_data, room=room_id, namespace='/multiplayer')
        
        return jsonify({
            'success': True,
            'message': '帧同步测试完成',
            'room_id': room_id,
            'is_in_sync_list': is_in_sync_list,
            'sync_rooms_count': sync_rooms_count,
            'sync_rooms_list': sync_rooms_list
        })
        
    except Exception as e:
        logger.error(f"帧同步测试失败: {e}")
        return jsonify({'error': f'测试失败: {str(e)}'}), 500

if __name__ == '__main__':
    # 启动SocketIO服务器
    socketio.run(app, host='0.0.0.0', port=11452, debug=True) 