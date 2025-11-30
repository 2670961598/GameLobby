# 网页游戏平台 (Web Game Platform)

一个现代化的网页小游戏平台，支持游戏浏览、上传、在线游玩和多人游戏功能。

## 项目简介

这是一个基于 Flask 和 Vue.js 构建的网页游戏平台，提供了完整的游戏管理、排行榜、多人游戏等功能。平台支持用户上传自己的游戏，并提供了丰富的内置游戏库。

## 主要功能

- 🎮 **游戏浏览与游玩**：浏览和在线游玩各种网页小游戏
- 📤 **游戏上传**：支持上传 ZIP 压缩包或外部链接的游戏
- 🏆 **排行榜系统**：记录和展示各游戏的最高分排行榜
- 👥 **多人游戏**：基于 WebSocket 的实时多人游戏支持
- 📊 **游戏统计**：记录游戏点击量、作者信息等统计数据
- 🖥️ **桌面应用**：支持 Electron 打包为桌面应用

## 技术栈

### 后端
- **Flask 2.3.3** - Web 框架
- **Flask-SQLAlchemy 3.0.5** - ORM 数据库操作
- **Flask-SocketIO 5.3.6** - WebSocket 实时通信
- **PyMySQL 1.1.0** - MySQL 数据库驱动

### 前端
- **Vue.js 3.4.38** - 前端框架
- **TypeScript** - 类型安全的 JavaScript
- **Vue Router 4.2.5** - 路由管理
- **Pinia 2.1.7** - 状态管理
- **Axios 1.6.2** - HTTP 客户端
- **Vite 5.4.2** - 构建工具

### 数据库
- **MySQL** - 关系型数据库

## 项目结构

```
server/
├── app.py                 # Flask 主应用文件
├── models.py              # 数据库模型定义
├── extensions.py          # Flask 扩展初始化
├── init_games.py          # 游戏配置初始化脚本
├── requirements.txt       # Python 依赖
├── templates/             # 游戏模板目录
│   ├── games/            # 内置游戏
│   ├── user_games/       # 用户上传的游戏
│   └── multiplayer_games/ # 多人游戏
├── static/                # 静态资源
│   └── dist/             # Vue 构建产物
├── webGamesVue/          # Vue 前端项目
│   ├── src/              # 源代码
│   ├── public/           # 公共资源
│   └── package.json      # Node.js 依赖
└── logs/                 # 日志文件
```

## 安装与配置

### 环境要求

- Python 3.8+
- Node.js 16+
- MySQL 5.7+ 或 8.0+

### 1. 克隆项目

```bash
git clone <repository-url>
cd server
```

### 2. 配置数据库

创建 MySQL 数据库：

```sql
CREATE DATABASE gameplatform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

修改 `app.py` 中的数据库连接配置（第 102 行）：

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://用户名:密码@localhost:3306/gameplatform?charset=utf8mb4'
```

### 3. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 4. 初始化数据库和游戏配置

```bash
python init_games.py
```

### 5. 安装前端依赖并构建

**方式一：使用自动化脚本（推荐）**

```bash
python updateVue.py
```

该脚本会自动完成：
- 安装前端依赖（npm install）
- 构建 Vue 项目（npm run build）
- 部署到 static/dist 目录

**方式二：手动构建**

```bash
cd webGamesVue
npm install
npm run build
cd ..
```

### 6. 运行服务器

```bash
python app.py
```

服务器默认运行在 `http://localhost:5000`

## 使用说明

### 游戏上传

平台提供完全自动化的游戏上传功能，无需手动操作：

1. **上传 ZIP 压缩包**
   - 访问 `/upload-game` 页面
   - 选择包含 `index.html` 的 ZIP 文件
   - 系统会自动解压、部署并配置游戏，立即可用

2. **上传外部链接**
   - 通过 Web 界面或 API `/upload-link` 提交游戏链接
   - 系统自动添加外部游戏链接，支持即时访问

所有上传的游戏都会自动：
- 解压和部署到服务器
- 在数据库中创建配置记录
- 出现在游戏列表中供用户游玩

### 多人游戏

平台支持基于 WebSocket 的多人游戏功能：

- **创建房间**：`POST /api/multiplayer/create_room`
- **获取房间列表**：`GET /api/multiplayer/rooms`
- **加入房间**：`POST /api/multiplayer/join_room`

### 排行榜

每个游戏支持多个难度级别的排行榜：

- 提交分数：`POST /submit-score`
- 查看排行榜：`GET /leaderboard/<game_id>`

### 管理后台

访问 `/admin` 可以查看：
- 所有游戏列表
- 游戏统计数据
- 用户上传的游戏

## API 接口

### 游戏相关

- `GET /` - 首页
- `GET /game/<game_id>/` - 游戏页面
- `GET /game/<game_id>/<path:filename>` - 游戏资源文件
- `POST /submit-score` - 提交分数
- `GET /leaderboard/<game_id>` - 获取排行榜

### 上传相关

- `POST /upload-game` - 上传单文件游戏
- `POST /upload-zip` - 上传 ZIP 压缩包
- `POST /upload-link` - 上传外部链接

### 多人游戏

- `POST /api/multiplayer/create_room` - 创建房间
- `GET /api/multiplayer/rooms` - 获取房间列表
- `POST /api/multiplayer/join_room` - 加入房间

## 数据库模型

### Score
游戏分数记录表，包含：
- `game_id` - 游戏ID
- `difficulty` - 难度级别
- `player_name` - 玩家名称
- `score` - 分数

### GameConfigModel
游戏配置表，包含：
- `game_id` - 游戏ID（主键）
- `ip` - 上传者IP
- `author` - 作者名称
- `timestamp` - 上传时间
- `clicks` - 点击量
- `external` - 是否外部链接
- `link` - 外部链接地址

### UserName
用户昵称映射表

### IPBlacklist
IP 黑名单表

## 安全特性

- 输入过滤和 HTML 转义
- 房间名称验证
- 权限检查机制
- 频率限制（可扩展）
- ZIP 文件大小限制（默认 200MB）

## 开发说明

### 前端开发

**开发模式**

```bash
cd webGamesVue
npm run dev  # 开发模式，支持热重载
```

**构建生产版本**

```bash
# 使用自动化脚本（推荐）
python updateVue.py

# 或手动构建
cd webGamesVue
npm install
npm run build
cd ..
```

### 日志

- 访问日志：`logs/access.log`
- 应用日志：控制台输出