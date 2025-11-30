# 新联机游戏系统使用说明

## 🎯 系统概述

全新的联机游戏系统已经完成重构，支持 P2P 和服务器中继两种模式，提供状态同步、帧同步等多种同步机制。

## 📁 目录结构

```
├── static/libs/
│   ├── socket.io.min.js         # Socket.IO 客户端库
│   └── multiplayer.js           # 多人游戏客户端封装库
├── templates/multiplayer_games/  # 多人游戏目录
│   └── chat_room/               # 示例聊天室游戏
│       └── index.html
└── multiplayer_game.md          # 详细技术文档
```

## 🚀 快速开始

### 1. 创建多人游戏

在 `templates/multiplayer_games/` 目录下创建游戏文件夹，包含 `index.html` 作为入口。

### 2. 引入客户端库

```html
<!-- 引入 Socket.IO -->
<script src="/static/libs/socket.io.min.js"></script>
<!-- 引入多人游戏库 -->
<script src="/static/libs/multiplayer.js"></script>
```

### 3. 初始化客户端

```javascript
// 创建客户端实例
const client = new MultiplayerClient();

// 设置事件回调
client.on('onStateSync', (data) => {
    // 处理状态同步
    console.log('收到状态同步:', data);
});

client.on('onFrameSync', (data) => {
    // 处理帧同步
    console.log('收到帧同步:', data);
});

client.on('onPlayerLeft', (data) => {
    // 处理玩家离开
    console.log('玩家离开:', data.player_ip);
});

client.on('onRoomClosed', (data) => {
    // 处理房间关闭
    alert('房间已关闭: ' + data.message);
});
```

## 📚 API 接口说明

### 房间管理

#### 创建房间

```javascript
const result = await client.createRoom('房间名称');
if (result.success) {
    console.log('房间创建成功:', result.room_id);
}
```

#### 获取房间列表

```javascript
const rooms = await client.getRooms();
console.log('可用房间:', rooms);
```

#### 加入房间

```javascript
const result = await client.joinRoom('房间ID');
if (result.success) {
    if (result.mode === 'p2p') {
        console.log('P2P模式，房主IP:', result.host_ip);
    } else if (result.mode === '服务器中继') {
        console.log('服务器中继模式，同步类型:', result.sync_type);
    }
}
```

### 游戏配置（仅房主）

#### 初始化游戏设置

```javascript
await client.updateGameInfo({
    gameMode: '服务器中继',        // 'p2p' 或 '服务器中继'
    syncType: '状态同步',          // '状态同步', '帧同步', '用户自定义'
    players: ['192.168.1.100'],   // 玩家IP列表
    customInfo: {                 // 自定义配置
        difficulty: 'normal',
        maxScore: 1000
    }
});
```

#### 更新房间信息

```javascript
// 可多次调用更新配置
await client.updateGameInfo({
    gameMode: '服务器中继',  // 首次设置后不可修改
    syncType: '状态同步',    // 首次设置后不可修改
    players: updatedPlayersList,
    customInfo: newConfig
});
```

### 数据传输

#### 发送数据

```javascript
// 发送游戏状态或操作
await client.sendData({
    type: 'player_move',
    x: 100,
    y: 200,
    timestamp: Date.now()
});
```

#### 退出房间

```javascript
await client.exitRoom();
```

## 🔄 同步模式详解

### 状态同步

**适用场景**：回合制游戏、卡牌游戏、聊天室

**工作原理**：

- 玩家发送完整游戏状态
- 服务器保存最新状态（最大 10MB）
- 新玩家加入时自动同步最新状态
- 适合状态变化不频繁的游戏

**示例代码**：

```javascript
// 发送完整游戏状态
await client.sendData({
    gameState: {
        players: [...],
        board: [...],
        currentTurn: 'player1'
    }
});

// 接收状态同步
client.on('onStateSync', (data) => {
    if (data.type === 'initial_state') {
        // 初始状态（新玩家加入时）
        loadGameState(data.data);
    } else {
        // 状态更新
        updateGameState(data.data);
    }
});
```

### 帧同步

**适用场景**：实时对战游戏、动作游戏

**工作原理**：

- 16 tick/秒的同步频率（62.5ms 间隔）
- 每个玩家维护操作队列（最大 10 个操作）
- 每个 tick 广播所有玩家的操作
- 确保游戏逻辑的一致性

**示例代码**：

```javascript
// 发送操作指令
await client.sendData({
    action: 'move',
    direction: 'up',
    timestamp: Date.now()
});

// 接收帧同步
client.on('onFrameSync', (data) => {
    // data.tick: 当前帧号
    // data.players: 所有玩家的操作
    for (const [playerIP, operations] of Object.entries(data.players)) {
        operations.forEach(op => {
            executePlayerOperation(playerIP, op);
        });
    }
});
```

### 用户自定义

**适用场景**：特殊需求的游戏

**工作原理**：

- 直接广播数据，不做特殊处理
- 游戏自行处理同步逻辑
- 最大灵活性

## 🌐 P2P 模式

P2P 模式下，服务器仅提供房主 IP，实际连接由游戏自行实现：

```javascript
const result = await client.joinRoom('房间ID');
if (result.mode === 'p2p') {
    const hostIP = result.host_ip;
    // 游戏需要自行实现与房主的 P2P 连接
    connectToHost(hostIP);
}
```

## 🎮 示例游戏

### 多人聊天室

位置：`/multiplayer_game/chat_room/`

**功能特点**：

- 状态同步实现
- 实时消息广播
- 房间管理界面
- 玩家加入/离开通知

**学习要点**：

- 如何创建和加入房间
- 如何使用状态同步
- 如何处理玩家事件
- WebSocket 连接管理

## 🔧 高级特性

### 错误处理

```javascript
client.on('onError', (error) => {
    console.error('联机错误:', error);
    // 处理连接错误、权限错误等
});
```

### 连接状态监控

```javascript
// WebSocket 连接状态会自动管理
// 断线重连由客户端库自动处理
```

### 房间权限管理

- 只有房主可以调用 `updateGameInfo()`
- 房主退出时房间自动销毁
- 支持预留房主转移接口（待实现）

## 🚨 注意事项

1. **数据大小限制**：

   - 状态同步：最大 10MB
   - 帧同步：操作队列最大 10 个
2. **房间人数**：

   - 默认最大 20 人
   - 可在 `updateGameInfo` 中配置
3. **内存存储**：

   - 所有房间数据存储在内存中
   - 服务器重启时数据丢失
4. **网络要求**：

   - 需要 WebSocket 支持
   - P2P 模式需要玩家间网络互通

## 📖 更多资源

- [详细技术文档](./multiplayer_game.md)
- [示例游戏源码](./templates/multiplayer_games/chat_room/)
- [客户端库源码](./static/libs/multiplayer.js)

## 🔄 版本更新

### v2.0.0 (当前版本)

- ✅ 完全重构联机系统
- ✅ 支持 P2P 和服务器中继模式
- ✅ 支持状态同步和帧同步
- ✅ 提供客户端封装库
- ✅ 创建示例游戏
- ✅ 详细文档和使用说明

### 后续计划

- 🔲 房主转移功能
- 🔲 观战者模式
- �� 游戏录像回放
- 🔲 更多示例游戏
