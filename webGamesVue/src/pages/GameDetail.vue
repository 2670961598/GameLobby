<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../store/game'
import { 
  isGameCached, 
  saveGameToCache 
} from '../modules/game/services/gameService'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const gameId = route.params.id as string
const isLoading = ref(true)
const error = ref('')
const isCached = ref(false)
const isCaching = ref(false)

onMounted(async () => {
  try {
    await gameStore.loadGame(gameId)
    if (!gameStore.currentGame) {
      error.value = 'Game not found'
      return
    }
    
    // Check if game is cached
    isCached.value = await isGameCached(gameId)
  } catch (err) {
    error.value = 'Failed to load the game'
    console.error(err)
  } finally {
    isLoading.value = false
  }
})

const playGame = () => {
  console.log('从游戏详情页开始游戏（创建新房间）:', gameId)
  console.log('没有传递房间参数，游戏将自动生成新房间')
  router.push(`/play/${gameId}`)
}

const cacheGame = async () => {
  if (!gameStore.currentGame) return
  
  isCaching.value = true
  try {
    await saveGameToCache(gameStore.currentGame)
    isCached.value = true
  } catch (err) {
    console.error('Failed to cache game:', err)
  } finally {
    isCaching.value = false
  }
}
</script>

<template>
  <div class="game-detail">
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading game details...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <router-link to="/games" class="btn-primary">Back to Games</router-link>
    </div>
    
    <template v-else-if="gameStore.currentGame">
      <div class="game-header">
        <div class="breadcrumbs">
          <router-link to="/games">Games</router-link>
          <span class="separator">›</span>
          <span>{{ gameStore.currentGame.title }}</span>
        </div>
      </div>
      
      <div class="game-content">
        <div class="game-thumbnail">
          <img 
            :src="gameStore.currentGame.thumbnailUrl || 'https://via.placeholder.com/600x400?text=Game'" 
            :alt="gameStore.currentGame.title"
          >
        </div>
        
        <div class="game-info">
          <h1>{{ gameStore.currentGame.title }}</h1>
          
          <div class="meta-tags">
            <span class="category-tag">{{ gameStore.currentGame.category }}</span>
            <span v-if="gameStore.currentGame.playerCount" class="player-tag">
              {{ gameStore.currentGame.playerCount }} Player{{ gameStore.currentGame.playerCount > 1 ? 's' : '' }}
            </span>
            <span v-if="isCached" class="offline-tag">Available Offline</span>
          </div>
          
          <div class="description">
            <p>{{ gameStore.currentGame.description }}</p>
          </div>
          
          <div class="game-details">
            <div class="detail-item">
              <span class="label">Controls:</span>
              <span>{{ gameStore.currentGame.controls || 'Mouse and keyboard' }}</span>
            </div>
            
            <div v-if="gameStore.currentGame.author" class="detail-item">
              <span class="label">Created by:</span>
              <span>{{ gameStore.currentGame.author }}</span>
            </div>
            
            <div v-if="gameStore.currentGame.version" class="detail-item">
              <span class="label">Version:</span>
              <span>{{ gameStore.currentGame.version }}</span>
            </div>
          </div>
          
          <div class="action-buttons">
            <button @click="playGame" class="play-button">
              Play Game
            </button>
            
            <button 
              v-if="!isCached && gameStore.currentGame.isOfflineAvailable" 
              @click="cacheGame" 
              class="cache-button"
              :disabled="isCaching"
            >
              <span v-if="isCaching">Saving...</span>
              <span v-else>Save for Offline</span>
            </button>
            
            <button v-else-if="isCached" class="share-button">
              Share Game
            </button>
          </div>
        </div>
      </div>
      
      <div class="game-stats">
        <div class="stats-card leaderboard-preview">
          <h3>Top Players</h3>
          <ul class="leaderboard-list">
            <li v-for="i in 3" :key="i" class="leaderboard-item">
              <span class="rank">{{ i }}</span>
              <span class="player-name">Player {{ i }}</span>
              <span class="score">{{ 1000 - (i * 150) }}</span>
            </li>
          </ul>
          <button class="view-all-btn">View Full Leaderboard</button>
        </div>
        
        <div class="stats-card game-stats-info">
          <h3>Game Stats</h3>
          <ul class="stats-list">
            <li>
              <span class="stat-label">Total Plays:</span>
              <span class="stat-value">1,245</span>
            </li>
            <li>
              <span class="stat-label">Average Rating:</span>
              <span class="stat-value">4.7 / 5</span>
            </li>
            <li>
              <span class="stat-label">Offline Players:</span>
              <span class="stat-value">278</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.game-detail {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.breadcrumbs a {
  color: var(--color-text-secondary);
  text-decoration: none;
}

.breadcrumbs a:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.separator {
  color: var(--color-text-secondary);
}

.game-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.game-thumbnail {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.game-thumbnail img {
  width: 100%;
  height: auto;
  display: block;
}

.game-info {
  flex: 1;
}

.game-info h1 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 2rem;
}

.meta-tags {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.meta-tags span {
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 500;
}

.category-tag {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
}

.player-tag {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--color-accent);
}

.offline-tag {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-secondary);
}

.description {
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.game-details {
  margin-bottom: 2rem;
}

.detail-item {
  margin-bottom: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.detail-item .label {
  font-weight: 600;
  min-width: 100px;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-buttons button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.play-button {
  background-color: var(--color-primary);
  color: white;
  border: none;
  flex: 3;
  min-width: 150px;
}

.play-button:hover {
  background-color: var(--color-primary-dark);
}

.cache-button, .share-button {
  background-color: white;
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex: 2;
  min-width: 150px;
}

.cache-button:hover, .share-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.cache-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.game-stats {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
  margin-top: 1rem;
}

.stats-card {
  background-color: var(--color-surface);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stats-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.leaderboard-list, .stats-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.leaderboard-item:last-child {
  border-bottom: none;
}

.rank {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-primary);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  margin-right: 1rem;
}

.player-name {
  flex: 1;
}

.score {
  font-weight: 600;
  color: var(--color-text);
}

.stats-list li {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.stats-list li:last-child {
  border-bottom: none;
}

.stat-value {
  font-weight: 600;
}

.view-all-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: transparent;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.view-all-btn:hover {
  background-color: rgba(59, 130, 246, 0.05);
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.loading-spinner {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-primary {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: var(--color-primary);
  color: white;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

@media (min-width: 768px) {
  .game-content {
    flex-direction: row;
  }
  
  .game-thumbnail {
    width: 40%;
  }
  
  .game-stats {
    grid-template-columns: 1fr 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .cache-button, .share-button {
    background-color: var(--color-surface-dark);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .cache-button:hover, .share-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .stats-card {
    background-color: var(--color-surface-dark);
  }
  
  .leaderboard-item, .stats-list li {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }
  
  .view-all-btn {
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--color-primary);
  }
}
</style>