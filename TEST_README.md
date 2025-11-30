# 测试文件说明

这个文件夹包含了多人游戏系统开发过程中的所有测试文件和相关文档。

## 测试脚本

### WebSocket测试

- `room_membership_test.py` - 房间成员身份测试
- `websocket_event_test.py` - WebSocket事件测试
- `websocket_trigger_test.py` - WebSocket触发器测试
- `websocket_test.py` - WebSocket通信测试
- `simple_ws_test.py` - 简单WebSocket连接测试
- `test_basic_socket.py` - 基础Socket.IO测试

### 帧同步测试

- `frame_sync_debug.py` - 帧同步调试脚本
- `server_test.py` - 服务器端测试（包含帧同步功能测试）

### 综合测试

- `manual_test.py` - 手动测试脚本
- `debug_websocket.py` - WebSocket调试工具
- `quick_verify.py` - 快速验证脚本
- `quick_fix_test.py` - 快速修复测试
- `quick_test.py` - 快速测试脚本
- `test_panic.py` - 紧急测试脚本

### 问题代码分析

- `problematic_code_segments.py` - 问题代码段分析

## 文档

### 开发文档

- `multiplayer_game_development.md` - 多人游戏开发完整文档
- `multiplayer_game.md` - 多人游戏设计文档
- `multiplayer_usage.md` - 多人游戏使用说明

### 测试文档

- `TEST_README.md` - 测试说明文档
- `failed_tests_example.md` - 测试失败示例
- `test_fixes.md` - 测试修复记录
- `test_fixes_summary.md` - 测试修复总结
- `test_issues_summary.md` - 测试问题总结

### 错误报告

- `error_reporting_summary.md` - 错误报告总结
- `multiplayer_fixes_summary.md` - 多人游戏修复总结

## 配置文件

- `test_requirements.txt` - 测试环境依赖包

## 日志文件

- `svn_monitor.log` - SVN监控日志

## 注意事项

这些文件主要用于开发和调试阶段，不应部署到生产环境。如果需要运行这些测试，请确保：

1. 安装了测试依赖：`pip install -r test_requirements.txt`
2. 主应用服务器正在运行
3. 网络连接正常

## 清理说明

这些文件已从主工作目录移动到test文件夹，保持主目录整洁的同时保留了完整的开发历史记录。
