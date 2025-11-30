# 多人游戏服务器测试问题修复

## 1. 测试脚本WebSocket客户端修复

测试脚本中使用了 `socketio.Client()`，但这个属性不存在。需要安装并使用正确的 socketio 客户端库：

```bash
pip install python-socketio
```

然后在测试脚本中修改：

```python
# 原来的代码
import socketio
sio = socketio.Client()

# 修改为
import socketio
sio = socketio.SimpleClient()
# 或者使用
sio = socketio.Client()
```

如果继续出现问题，可以使用以下完整的WebSocket客户端代码：

```python
import socketio

class SocketIOTestClient:
    def __init__(self, url, namespace):
        self.sio = socketio.Client()
        self.url = url
        self.namespace = namespace
        self.messages = []
        
        @self.sio.on('connect', namespace=namespace)
        def on_connect():
            print(f"Connected to {url}{namespace}")
            
        @self.sio.on('disconnect', namespace=namespace)
        def on_disconnect():
            print(f"Disconnected from {url}{namespace}")
            
        @self.sio.on('message', namespace=namespace)
        def on_message(data):
            self.messages.append(data)
            print(f"Received message: {data}")
    
    def connect(self):
        self.sio.connect(self.url, namespaces=[self.namespace])
    
    def disconnect(self):
        self.sio.disconnect()
    
    def join_room(self, room_id):
        self.sio.emit('join_room', {'room_id': room_id}, namespace=self.namespace)
    
    def get_messages(self):
        return self.messages
```

## 2. 权限控制测试修复

权限控制测试失败的原因是测试脚本使用同一个IP地址。需要模拟不同的IP地址：

```python
def update_game_info(self, game_mode, sync_type, is_host=True, custom_info=None):
    """更新游戏信息"""
    if not self.room_id:
        logger.error("未创建房间，无法更新游戏信息")
        return False
        
    try:
        data = {
            "room_id": self.room_id,
            "game_mode": game_mode,
            "sync_type": sync_type,
            "players": [self.host_ip],
            "custom_info": custom_info or {}
        }
        
        # 如果要测试非房主权限，使用不同的会话和header
        headers = {}
        if not is_host:
            headers['X-Forwarded-For'] = '192.168.1.100'  # 模拟不同IP
        
        response = requests.post(
            f"{API_BASE}/update_info", 
            json=data,
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                logger.info(f"游戏信息更新成功: 模式={game_mode}, 同步类型={sync_type}")
                return True
                
        logger.error(f"更新游戏信息失败: {response.text}")
        return False
    except requests.exceptions.Timeout:
        logger.error("更新游戏信息请求超时")
        return False
    except Exception as e:
        logger.error(f"更新游戏信息异常: {str(e)}")
        return False
```

## 3. 服务器端已修复的问题

1. **帧同步线程错误**: 修复了 `current_tick` 属性名错误，改为 `tick_count`
2. **日志文件锁定**: 移除了 TimedRotatingFileHandler，改用普通 FileHandler 避免Windows文件锁定
3. **权限控制**: 添加了更详细的权限检查日志
4. **房主退出房间**: 改进了房间清理逻辑，避免重复退出时的错误
5. **WebSocket广播**: 添加了更多调试日志来跟踪消息广播

## 4. 建议的测试环境改进

1. 使用 Docker 或虚拟机运行测试，避免Windows特有的文件锁定问题
2. 使用不同的网络接口或代理来模拟不同IP地址的客户端
3. 增加WebSocket连接的重试机制和错误处理
4. 添加更多的等待时间让异步操作完成

## 5. 运行测试前的准备

```bash
# 安装必要的依赖
pip install python-socketio requests

# 确保服务器正在运行
# 检查服务器地址和端口是否正确
# 确保防火墙允许WebSocket连接
``` 