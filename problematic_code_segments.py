#!/usr/bin/env python3
"""
测试脚本中有问题的代码段集合
以下代码段从 server_test.py 中提取，包含了所有需要修复的问题
"""

# ============================================================================
# 问题1: 硬编码服务器地址 (原第30-32行)
# ============================================================================
# 问题代码：
SERVER_URL = "http://172.18.67.143:11452"  # 请根据实际情况修改
API_BASE = f"{SERVER_URL}/api/multiplayer"
SOCKET_URL = f"{SERVER_URL}/multiplayer"

# 建议修复：
# import os
# SERVER_URL = os.getenv("TEST_SERVER_URL", "http://localhost:11452")
# API_BASE = f"{SERVER_URL}/api/multiplayer"
# SOCKET_URL = f"{SERVER_URL}/multiplayer"

# ============================================================================
# 问题2: 超时装饰器问题 (原第55-67行)
# ============================================================================
# 问题代码：
def with_timeout(timeout=10):
    """函数执行超时装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = [None]
            exception = [None]
            completed = [False]
            
            def target():
                try:
                    result[0] = func(*args, **kwargs)
                    completed[0] = True
                except Exception as e:
                    exception[0] = e
            
            thread = threading.Thread(target=target)
            thread.daemon = True
            thread.start()
            thread.join(timeout)
            
            if not completed[0]:  # 问题：无法区分超时和失败
                logger.warning(f"函数执行超时: {func.__name__}, 超时时间: {timeout}秒")
                return False
            
            if exception[0]:
                logger.error(f"函数执行异常: {func.__name__}, 异常: {exception[0]}")
                return False
                
            return result[0]
        return wrapper
    return decorator

# ============================================================================
# 问题3: WebSocket连接问题 (原第93-96行)
# ============================================================================
# 问题代码：
class SocketIOTestClient:
    def connect(self):
        """连接WebSocket"""
        try:
            self.sio.connect(self.url, namespaces=[self.namespace])
            # 等待连接建立
            time.sleep(1)  # 问题：固定等待时间，可能不够
            return self.connected
        except Exception as e:
            logger.error(f"玩家 {self.player_id} 连接失败: {str(e)}")
            return False

# ============================================================================
# 问题4: 线程安全问题 (原第74-80行)
# ============================================================================
# 问题代码：
class SocketIOTestClient:
    def __init__(self, url, namespace, player_id):
        self.messages = []  # 问题：线程不安全
        
        @self.sio.on('message', namespace=namespace)
        def on_message(data):
            self.messages.append(data)  # 问题：多线程环境下不安全
            logger.info(f"玩家 {player_id} 收到消息: {data}")

# ============================================================================
# 问题5: 权限测试逻辑错误 (原第302-307行)
# ============================================================================
# 问题代码：
def test_permissions(self):
    """测试权限控制"""
    # 测试非房主权限（应该失败）
    logger.info("测试非房主权限...")
    non_host_result = self.update_game_info("服务器中继", "帧同步", is_host=False)
    # 非房主应该失败，所以期望结果是False
    self.test_results["非房主权限-更新游戏信息被拒绝"] = not non_host_result  # 问题：逻辑混乱

# ============================================================================
# 问题6: 异常处理过于宽泛 (多处位置)
# ============================================================================
# 问题代码：
def create_room(self, room_name):
    """创建房间"""
    try:
        response = requests.post(
            f"{API_BASE}/create_room",
            json={"room_name": room_name},
            timeout=5
        )
        
        if response.status_code == 200:
            # 处理响应...
            pass
            
    except Exception as e:  # 问题：捕获过于宽泛
        logger.error(f"创建房间异常: {str(e)}")  # 问题：错误信息不详细
        return False

# ============================================================================
# 问题7: 资源清理问题 (原第730-738行)
# ============================================================================
# 问题代码：
def close_socket_connections(self):
    """关闭WebSocket连接"""
    for i, client in self.player_sockets.items():
        try:
            client.disconnect()
            logger.info(f"玩家 {i} WebSocket连接已关闭")
        except Exception as e:
            logger.error(f"关闭WebSocket连接异常: {str(e)}")
            
    self.player_sockets = {}  # 问题：即使有连接关闭失败，也清空所有记录

# ============================================================================
# 问题8: 测试结果判断逻辑错误 (原第741-753行)
# ============================================================================
# 问题代码：
def test_state_synchronization(self):
    # 检查玩家是否收到状态
    player_received = False
    if 1 in self.player_sockets:
        messages = self.player_sockets[1].get_messages()
        for msg in messages:
            if msg.get('type') == 'state_sync':
                player_data = msg.get('data')
                if player_data and 'players' in player_data and 'gameObjects' in player_data:
                    player_received = True
                    break  # 问题：只检查第一个匹配的消息

# ============================================================================
# 问题9: 高负载测试数据生成问题 (原第334-336行)
# ============================================================================
# 问题代码：
def test_large_payload(self):
    """测试大数据负载"""
    # 生成大数据
    large_data = {
        "large_field": "x" * (11 * 1024 * 1024)  # 问题：11MB数据可能导致内存问题
    }

# ============================================================================
# 问题10: 测试顺序依赖性问题 (原第146-160行)
# ============================================================================
# 问题代码：
def run_all_tests(self):
    """运行所有测试"""
    logger.info("开始运行多人游戏服务器全面测试")
    
    # 测试房间管理
    self.test_room_management()  # 问题：测试失败可能影响后续测试
    
    # 测试不同同步模式
    self.test_state_sync_mode()
    self.test_frame_sync_mode()
    self.test_custom_sync_mode()

# ============================================================================
# 问题11: 退出房间超时处理 (原第609-630行)
# ============================================================================
# 问题代码：
def exit_room(self, is_host=False, room_id=None, player_index=1):
    """退出房间"""
    room_id = room_id or self.room_id
    if not room_id:
        logger.error("未指定房间ID，无法退出")
        return False
        
    try:
        response = requests.post(
            f"{API_BASE}/exit_room",
            json={"room_id": room_id},
            timeout=5  # 问题：固定超时时间可能不够
        )
        
        if response.status_code == 200:
            # 处理响应...
            pass
            
    except requests.exceptions.Timeout:
        logger.error(f"退出房间请求超时")
        return False
    except Exception as e:  # 问题：异常处理过于宽泛
        logger.error(f"退出房间异常: {str(e)}")
        return False

# ============================================================================
# 问题12: 帧同步测试频率计算问题 (原第808-825行)
# ============================================================================
# 问题代码：
def test_frame_synchronization(self):
    # 检查帧同步频率是否接近16tick/秒
    if 0 in self.sync_times and len(self.sync_times[0]) >= 2:
        intervals = []
        times = self.sync_times[0]
        for i in range(1, len(times)):
            intervals.append(times[i] - times[i-1])
            
        avg_interval = sum(intervals) / len(intervals)
        expected_interval = 1.0 / 16  # 16 tick/秒
        
        # 允许20%的误差
        is_correct_frequency = abs(avg_interval - expected_interval) / expected_interval <= 0.2
        # 问题：误差计算可能除零，没有边界检查

# ============================================================================
# 问题13: 压力测试房间活动模拟 (原第1176-1207行)
# ============================================================================
# 问题代码：
def room_activity_simulation(self, room_id):
    """单个房间的活动模拟"""
    # 模拟30秒的游戏活动
    start_time = time.time()
    end_time = start_time + 30
    update_count = 0
    
    while time.time() < end_time:
        try:
            # 发送随机游戏数据
            data = {
                "timestamp": time.time(),
                "random_data": random.randint(1, 1000),
                "action": random.choice(["move", "attack", "defend", "use_item"]),
                "position": {
                    "x": random.randint(0, 800),
                    "y": random.randint(0, 600)
                }
            }
            
            response = requests.post(
                f"{API_BASE}/submit_state",
                json={"room_id": room_id, "data": data}
            )
            
            if response.status_code == 200 and response.json().get("success"):
                update_count += 1
                
            # 随机间隔
            time.sleep(random.uniform(0.05, 0.2))
        except Exception as e:  # 问题：异常处理过于宽泛
            logger.error(f"房间活动模拟异常: {str(e)}")
            # 问题：没有错误计数和退出机制

# ============================================================================
# 问题14: 安全测试中的XSS检测 (原第1283-1306行)
# ============================================================================
# 问题代码：
def test_xss(self):
    """测试XSS攻击"""
    # XSS测试字符串
    xss_strings = [
        "<script>alert('XSS')</script>",
        "<img src='x' onerror='alert(\"XSS\")'>",
        "<svg onload='alert(\"XSS\")'>",
        "javascript:alert('XSS')"
    ]
    
    for xss in xss_strings:
        try:
            # 尝试在房间名或游戏数据中注入XSS
            response = requests.post(
                f"{API_BASE}/create_room",
                json={"room_name": xss}
            )
            
            if response.status_code == 200:
                logger.info(f"XSS测试房间创建: {xss}")
                # 问题：没有真正验证XSS是否被防御
                
        except Exception as e:
            logger.error(f"XSS测试异常: {str(e)}")
            
    # 假设我们无法直接检测XSS是否成功，但服务器仍在运行
    self.test_results["XSS攻击防御"] = True  # 问题：假设性的测试结果

# ============================================================================
# 问题15: 内存和资源泄漏风险
# ============================================================================
# 问题代码：
def test_high_frequency_updates(self, num_players):
    """测试高频率更新"""
    # 创建多个WebSocket连接
    self.create_socket_connections(num_players)
    
    # 高频率发送状态更新
    for i in range(100):  # 发送100个更新
        for player_id in range(num_players):
            state = {
                "player_id": player_id,
                "position": {"x": random.randint(0, 800), "y": random.randint(0, 600)},
                "timestamp": time.time()
            }
            
            if self.submit_state(state, player_index=player_id):
                update_count += 1
                
            time.sleep(0.01)  # 10ms间隔
            
    # 问题：没有检查内存使用量增长
    # 问题：没有验证连接数是否正常

"""
总结：
1. 配置和环境问题：硬编码配置，缺少环境变量
2. 网络和超时问题：固定超时时间，重试机制缺失
3. 资源管理问题：连接清理不彻底，内存检查缺失
4. 异常处理问题：捕获过于宽泛，错误信息不详细
5. 线程安全问题：多线程环境下的数据竞争
6. 测试逻辑问题：判断条件错误，依赖关系处理不当
7. 安全测试问题：验证机制不够严格
8. 性能测试问题：缺少资源使用监控
""" 