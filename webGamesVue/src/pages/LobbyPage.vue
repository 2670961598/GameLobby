<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'

interface Room {
  game: string
  room: string
  players: number
  host_ip: string
  gameName?: string
  maxPlayers: number
  gameType: string
}

interface Game {
  id: string
  title: string
}

const router = useRouter()
const rooms = ref<Room[]>([])
const games = ref<Game[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedGame = ref('')
const newRoomId = ref('')
const showCreateDialog = ref(false)

// 过滤房间
const filteredRooms = computed(() => {
  let filtered = rooms.value

  // 按游戏筛选
  if (selectedGame.value) {
    filtered = filtered.filter(room => room.game === selectedGame.value)
  }

  // 按房间号或游戏名搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(room => 
      room.room.toLowerCase().includes(query) ||
      (room.gameName || room.game).toLowerCase().includes(query)
    )
  }

  return filtered
})

// 获取房间列表
const fetchRooms = async () => {
  try {
    const response = await fetch('/api/rooms')
    const data = await response.json()
    rooms.value = data.rooms || []
  } catch (error) {
    console.error('获取房间列表失败:', error)
  }
}

// 获取游戏列表
const fetchGames = async () => {
  try {
    const response = await fetch('/api/games')
    const data = await response.json()
    games.value = data.games.map((game: any) => ({
      id: game.id,
      title: game.title
    }))
  } catch (error) {
    console.error('获取游戏列表失败:', error)
  }
}

// 加入房间
const joinRoom = (room: Room, isSpectator: boolean = false) => {
  console.log('加入房间:', room)
  console.log('房间号:', room.room)
  console.log('游戏ID:', room.game)
  console.log('观战模式:', isSpectator)
  
  // 使用Vue路由导航到游戏页面，并传递房间信息
  const query: any = { room: room.room }
  if (isSpectator) {
    query.spectator = 'true'
  }
  
  router.push({
    name: 'GamePlay',
    params: { id: room.game },
    query
  })
}

// 观战房间
const spectateRoom = (room: Room) => {
  joinRoom(room, true)
}

// 创建房间
const createRoom = () => {
  if (!selectedGame.value || !newRoomId.value.trim()) {
    alert('请选择游戏并输入房间号')
    return
  }
  
  // 使用Vue路由导航到游戏页面
  router.push({
    name: 'GamePlay',
    params: { id: selectedGame.value },
    query: { room: newRoomId.value.trim() }
  })
  
  // 关闭对话框并重置
  showCreateDialog.value = false
  newRoomId.value = ''
}

// 快速加入
const quickJoin = () => {
  const availableRooms = filteredRooms.value.filter(room => room.players < room.maxPlayers)
  if (availableRooms.length > 0) {
    joinRoom(availableRooms[0])
  } else {
    alert('暂无可加入的房间')
  }
}

// 刷新房间列表
const refreshRooms = () => {
  fetchRooms()
}

onMounted(async () => {
  await Promise.all([fetchRooms(), fetchGames()])
  isLoading.value = false
  
  // 定时刷新房间列表
  const interval = setInterval(fetchRooms, 5000)
  
  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<template>
  <div class="lobby-page">
    <div class="container">
      <header class="lobby-header">
        <div class="header-content">
          <h1>🎮 联机大厅</h1>
          <p>与其他玩家连接，享受多人游戏乐趣</p>
        </div>
        <div class="header-actions">
          <button @click="showCreateDialog = true" class="btn-primary">
            <span class="btn-icon">➕</span>
            创建房间
          </button>
          <button @click="quickJoin" class="btn-secondary">
            <span class="btn-icon">🚀</span>
            快速加入
          </button>
        </div>
      </header>

      <div class="lobby-controls">
        <div class="search-bar">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索房间号或游戏名..."
            class="search-input"
          >
          <button @click="refreshRooms" class="refresh-btn" title="刷新">
            🔄
          </button>
        </div>
        
        <div class="game-filter">
          <select v-model="selectedGame" class="game-select">
            <option value="">所有游戏</option>
            <option v-for="game in games" :key="game.id" :value="game.id">
              {{ game.title }}
            </option>
          </select>
        </div>
      </div>

      <div class="room-list">
        <div v-if="isLoading" class="loading">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        
        <div v-else-if="filteredRooms.length === 0" class="empty-state">
          <div class="empty-icon">🏠</div>
          <h3>暂无房间</h3>
          <p>没有找到匹配的房间，创建一个新房间开始游戏吧！</p>
        </div>
        
        <div v-else class="rooms-grid">
          <div 
            v-for="room in filteredRooms" 
            :key="`${room.game}-${room.room}`"
            class="room-card"
            :class="{ 'room-full': room.players >= room.maxPlayers }"
          >
            <div class="room-header">
              <h3 class="room-name">{{ room.room }}</h3>
              <span class="room-status" :class="room.players >= room.maxPlayers ? 'full' : 'available'">
                {{ room.players >= room.maxPlayers ? '已满' : '可加入' }}
              </span>
            </div>
            
            <div class="room-info">
              <div class="game-info">
                <span class="game-name">{{ room.gameName || room.game }}</span>
              </div>
              
              <div class="player-info">
                <span class="player-count">
                  👥 {{ room.players }}/{{ room.maxPlayers }}
                </span>
                <span class="host-info">
                  🏠 {{ room.host_ip }}
                </span>
              </div>
            </div>
            
            <div class="room-actions">
              <button 
                v-if="room.players < room.maxPlayers"
                @click="joinRoom(room)" 
                class="join-btn"
              >
                加入房间
              </button>
              
              <div v-else class="room-full-actions">
                <span class="room-full-text">房间已满</span>
                <button 
                  v-if="room.gameType === 'multiplayer' || room.gameType === 'coop'"
                  @click="spectateRoom(room)" 
                  class="spectate-btn"
                >
                  观战
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建房间对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="showCreateDialog = false">
      <div class="dialog" @click.stop>
        <h3>创建新房间</h3>
        
        <div class="form-group">
          <label>选择游戏</label>
          <select v-model="selectedGame" class="form-select" required>
            <option value="">请选择游戏</option>
            <option v-for="game in games" :key="game.id" :value="game.id">
              {{ game.title }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label>房间号</label>
          <input 
            v-model="newRoomId"
            type="text" 
            placeholder="输入房间号..."
            class="form-input"
            maxlength="20"
            required
          >
        </div>
        
        <div class="dialog-actions">
          <button @click="showCreateDialog = false" class="btn-cancel">取消</button>
          <button @click="createRoom" class="btn-confirm">创建房间</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.header-content h1 {
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
  font-size: 2rem;
}

.header-content p {
  margin: 0;
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn-primary, .btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
}

.btn-secondary:hover {
  background: var(--color-secondary-dark);
  transform: translateY(-2px);
}

.lobby-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.refresh-btn {
  padding: 0.75rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #f8f9fa;
  transform: rotate(180deg);
}

.game-filter {
  min-width: 200px;
}

.game-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
}

.room-list {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.loading {
  text-align: center;
  padding: 3rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.rooms-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.room-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.room-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.room-card.room-full {
  opacity: 0.6;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.room-name {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.room-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.room-status.available {
  background: #d4edda;
  color: #155724;
}

.room-status.full {
  background: #f8d7da;
  color: #721c24;
}

.room-info {
  margin-bottom: 1rem;
}

.game-info {
  margin-bottom: 0.5rem;
}

.game-name {
  font-weight: 600;
  color: var(--color-text);
}

.player-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.room-actions {
  display: flex;
  gap: 0.5rem;
}

.join-btn {
  padding: 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.join-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.join-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.room-full-actions {
  display: flex;
  gap: 0.5rem;
}

.room-full-text {
  padding: 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.spectate-btn {
  padding: 0.75rem;
  background: var(--color-secondary);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.spectate-btn:hover {
  background: var(--color-secondary-dark);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 400px;
}

.dialog h3 {
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.form-select, .form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-confirm {
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .lobby-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .lobby-controls {
    flex-direction: column;
  }

  .rooms-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .lobby-page {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%);
  }

  .lobby-header, .room-list {
    background: var(--color-surface-dark);
    color: var(--color-text-dark);
  }

  .room-card {
    background: #374151;
  }

  .dialog {
    background: var(--color-surface-dark);
    color: var(--color-text-dark);
  }

  .form-select, .form-input, .search-input {
    background: #374151;
    border-color: #4b5563;
    color: var(--color-text-dark);
  }
}
</style> 