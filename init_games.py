"""
游戏配置初始化脚本
扫描游戏目录，确保所有目录中的游戏在数据库中有配置记录
"""
import os
from datetime import datetime
from flask import Flask
from extensions import db
from models import GameConfigModel
import logging

# 创建 Flask 应用上下文
app = Flask(__name__, template_folder='templates')
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:020126@localhost:3306/gameplatform?charset=utf8mb4'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# 游戏目录路径（与 app.py 保持一致）
BUILTIN_GAMES_DIR = os.path.join(app.template_folder, "games")
UPLOAD_FOLDER = os.path.join(app.template_folder, "user_games")

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def scan_game_directories():
    """扫描游戏目录，返回所有游戏ID列表"""
    games = []
    
    # 扫描 templates/games/ 目录
    if os.path.exists(BUILTIN_GAMES_DIR):
        try:
            for d in os.listdir(BUILTIN_GAMES_DIR):
                folder_path = os.path.join(BUILTIN_GAMES_DIR, d)
                if not os.path.isdir(folder_path):
                    continue
                index_tpl = os.path.join(folder_path, "index.html")
                if not os.path.isfile(index_tpl):
                    continue
                games.append(d)
        except Exception as e:
            logger.error(f"扫描 {BUILTIN_GAMES_DIR} 目录失败: {e}")
    
    # 扫描 templates/user_games/ 目录（旧版单文件游戏）
    if os.path.exists(UPLOAD_FOLDER):
        try:
            for fname in os.listdir(UPLOAD_FOLDER):
                if not fname.lower().endswith(".html"):
                    continue
                game_id = os.path.splitext(fname)[0]
                if game_id not in games:
                    games.append(game_id)
        except Exception as e:
            logger.error(f"扫描 {UPLOAD_FOLDER} 目录失败: {e}")
    
    return games


def init_game_configs():
    """初始化游戏配置：扫描目录并与数据库同步"""
    with app.app_context():
        # 1. 扫描目录获取所有游戏
        game_ids = scan_game_directories()
        logger.info(f"扫描到 {len(game_ids)} 个游戏: {game_ids[:10]}...")
        
        # 2. 从数据库获取已有配置
        existing_configs = {row.game_id for row in GameConfigModel.query.all()}
        logger.info(f"数据库中有 {len(existing_configs)} 个游戏配置")
        
        # 3. 找出需要创建配置的游戏
        new_games = [gid for gid in game_ids if gid not in existing_configs]
        
        if not new_games:
            logger.info("所有游戏都已配置，无需初始化")
            return
        
        logger.info(f"需要为 {len(new_games)} 个游戏创建配置: {new_games}")
        
        # 4. 为每个新游戏创建默认配置
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        created_count = 0
        
        for game_id in new_games:
            try:
                # 检查是否已存在（避免并发问题）
                existing = GameConfigModel.query.get(game_id)
                if existing:
                    continue
                
                # 创建新配置
                config = GameConfigModel(
                    game_id=game_id,
                    ip="",
                    author="匿名",
                    timestamp=now_str,
                    clicks=0,
                    external=False,
                    link=""
                )
                db.session.add(config)
                created_count += 1
                logger.info(f"为游戏 {game_id} 创建默认配置")
            except Exception as e:
                logger.error(f"为游戏 {game_id} 创建配置失败: {e}")
                continue
        
        # 5. 提交到数据库
        try:
            db.session.commit()
            logger.info(f"成功创建 {created_count} 个游戏配置")
        except Exception as e:
            db.session.rollback()
            logger.error(f"提交配置到数据库失败: {e}")
        
        # 6. 确保已有配置的完整性（补充缺失字段）
        updated_count = 0
        for game_id in game_ids:
            config = GameConfigModel.query.get(game_id)
            if not config:
                continue
            
            updated = False
            if not config.timestamp:
                config.timestamp = now_str
                updated = True
            if not config.author:
                config.author = "匿名"
                updated = True
            if config.clicks is None:
                config.clicks = 0
                updated = True
            
            if updated:
                updated_count += 1
        
        if updated_count > 0:
            try:
                db.session.commit()
                logger.info(f"更新了 {updated_count} 个游戏配置的缺失字段")
            except Exception as e:
                db.session.rollback()
                logger.error(f"更新配置失败: {e}")


if __name__ == '__main__':
    """作为独立脚本运行时"""
    print("开始初始化游戏配置...")
    init_game_configs()
    print("游戏配置初始化完成！")

