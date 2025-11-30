/**
 * 多人游戏客户端 Socket 库
 * 提供简单易用的多人游戏接口
 */

class MultiplayerClient {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.isHost = false;
        this.syncType = null;
        this.callbacks = {
            onStateSync: null,
            onFrameSync: null,
            onCustomSync: null,
            onPlayerJoined: null,
            onPlayerLeft: null,
            onRoomClosed: null,
            onError: null
        };
    }

    /**
     * 创建房间
     * @param {string} roomName - 房间名称
     * @returns {Promise<Object>} 创建结果
     */
    async createRoom(roomName) {
        try {
            const response = await fetch('/api/multiplayer/create_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_name: roomName
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.roomId = result.room_id;
                this.isHost = true;
                console.log('房间创建成功:', result);
            }
            
            return result;
        } catch (error) {
            console.error('创建房间失败:', error);
            throw error;
        }
    }

    /**
     * 获取房间列表
     * @returns {Promise<Array>} 房间列表
     */
    async getRooms() {
        try {
            const response = await fetch('/api/multiplayer/rooms');
            const result = await response.json();
            return result.rooms || [];
        } catch (error) {
            console.error('获取房间列表失败:', error);
            throw error;
        }
    }

    /**
     * 加入房间
     * @param {string} roomId - 房间ID
     * @returns {Promise<Object>} 加入结果
     */
    async joinRoom(roomId) {
        try {
            const response = await fetch('/api/multiplayer/join_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: roomId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.roomId = roomId;
                this.isHost = false;
                
                if (result.mode === 'p2p') {
                    console.log('P2P模式，房主IP:', result.host_ip);
                    // P2P模式需要游戏自行实现连接逻辑
                } else if (result.mode === '服务器中继') {
                    this.syncType = result.sync_type;
                    this._connectWebSocket();
                }
            }
            
            return result;
        } catch (error) {
            console.error('加入房间失败:', error);
            throw error;
        }
    }

    /**
     * 初始化游戏设置（仅房主可用）
     * @param {Object} config - 游戏配置
     * @param {string} config.gameMode - 游戏模式: 'p2p' 或 '服务器中继'
     * @param {string} config.syncType - 同步类型: '状态同步', '帧同步', '用户自定义'
     * @param {Array<string>} config.players - 玩家IP列表
     * @param {Object} config.customInfo - 自定义信息
     * @returns {Promise<Object>} 更新结果
     */
    async updateGameInfo(config) {
        if (!this.isHost) {
            throw new Error('只有房主可以更新游戏信息');
        }

        try {
            const response = await fetch('/api/multiplayer/update_info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: this.roomId,
                    game_mode: config.gameMode,
                    sync_type: config.syncType,
                    players: config.players || [],
                    custom_info: config.customInfo || {}
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.syncType = config.syncType;
                
                // 如果是服务器中继模式，建立WebSocket连接
                if (config.gameMode === '服务器中继') {
                    this._connectWebSocket();
                }
            }
            
            return result;
        } catch (error) {
            console.error('更新游戏信息失败:', error);
            throw error;
        }
    }

    /**
     * 发送游戏状态或操作数据
     * @param {any} data - 要发送的数据
     * @returns {Promise<Object>} 发送结果
     */
    async sendData(data) {
        try {
            const response = await fetch('/api/multiplayer/submit_state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: this.roomId,
                    data: data
                })
            });

            return await response.json();
        } catch (error) {
            console.error('发送数据失败:', error);
            throw error;
        }
    }

    /**
     * 退出房间
     * @returns {Promise<Object>} 退出结果
     */
    async exitRoom() {
        try {
            const response = await fetch('/api/multiplayer/exit_room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: this.roomId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this._disconnectWebSocket();
                this.roomId = null;
                this.isHost = false;
                this.syncType = null;
            }
            
            return result;
        } catch (error) {
            console.error('退出房间失败:', error);
            throw error;
        }
    }

    /**
     * 设置回调函数
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (event in this.callbacks) {
            this.callbacks[event] = callback;
        } else {
            console.warn('未知的事件类型:', event);
        }
    }

    /**
     * 建立WebSocket连接
     * @private
     */
    _connectWebSocket() {
        if (this.socket) {
            this.socket.disconnect();
        }

        // 使用Socket.IO连接
        this.socket = io('/multiplayer');

        this.socket.on('connect', () => {
            console.log('WebSocket连接成功');
            
            // 加入房间
            this.socket.emit('join_room', {
                room_id: this.roomId
            });
        });

        this.socket.on('message', (data) => {
            this._handleMessage(data);
        });

        this.socket.on('state_sync', (data) => {
            if (this.callbacks.onStateSync) {
                this.callbacks.onStateSync(data);
            }
        });

        this.socket.on('error', (error) => {
            console.error('WebSocket错误:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('WebSocket连接断开');
        });
    }

    /**
     * 断开WebSocket连接
     * @private
     */
    _disconnectWebSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * 处理接收到的消息
     * @private
     */
    _handleMessage(data) {
        switch (data.type) {
            case 'state_sync':
                if (this.callbacks.onStateSync) {
                    this.callbacks.onStateSync(data);
                }
                break;

            case 'frame_sync':
                if (this.callbacks.onFrameSync) {
                    this.callbacks.onFrameSync(data);
                }
                break;

            case 'custom_sync':
                if (this.callbacks.onCustomSync) {
                    this.callbacks.onCustomSync(data);
                }
                break;

            case 'player_left':
                if (this.callbacks.onPlayerLeft) {
                    this.callbacks.onPlayerLeft(data);
                }
                break;

            case 'room_closed':
                if (this.callbacks.onRoomClosed) {
                    this.callbacks.onRoomClosed(data);
                }
                this._disconnectWebSocket();
                this.roomId = null;
                this.isHost = false;
                break;

            default:
                console.log('收到未知类型消息:', data);
        }
    }
}

// 导出到全局
window.MultiplayerClient = MultiplayerClient; 