<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import GameCard from '../components/game/GameCard.vue'
import { useGameStore } from '../store/game'

const gameStore = useGameStore()
const isLoading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('all')
const sortBy = ref('popularity')

const categories = [
  { id: 'all', name: '全部游戏' },
  { id: 'action', name: '动作游戏' },
  { id: 'puzzle', name: '益智游戏' },
  { id: 'adventure', name: '冒险游戏' },
  { id: 'racing', name: '竞速游戏' },
  { id: 'strategy', name: '策略游戏' }
]

const sortOptions = [
  { id: 'default', name: '默认排序 (A-Z)' },
  { id: 'time', name: '时间排序' },
  { id: 'popularity', name: '热度排序' }
]

onMounted(async () => {
  try {
    await gameStore.fetchAllGames()
  } finally {
    isLoading.value = false
  }
})

const filteredGames = computed(() => {
  let games = gameStore.allGames.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          game.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = selectedCategory.value === 'all' || 
                            game.category === selectedCategory.value
    
    return matchesSearch && matchesCategory
  })

  // Apply sorting
  switch (sortBy.value) {
    case 'default':
      games = games.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'time':
      games = games.sort((a, b) => {
        const timeA = new Date(a.timestamp || '').getTime()
        const timeB = new Date(b.timestamp || '').getTime()
        return timeB - timeA // 最新的在前
      })
      break
    case 'popularity':
      games = games.sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      break
  }

  return games
})
</script>

<template>
  <div class="game-library">
    <div class="library-header">
      <h1>游戏库</h1>
      <p>探索并游玩我们收录的网页小游戏</p>
    </div>
    
    <div class="filters">
      <div class="search-bar">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索游戏..."
          aria-label="搜索游戏"
        >
      </div>
      
      <div class="category-filter">
        <select 
          v-model="selectedCategory"
          aria-label="按分类筛选"
        >
          <option 
            v-for="category in categories" 
            :key="category.id" 
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </div>
    </div>
    
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在加载游戏...</p>
    </div>
    
    <div v-else-if="filteredGames.length === 0" class="empty-state">
      <p v-if="searchQuery || selectedCategory !== 'all'">
        没有找到符合条件的游戏。
      </p>
      <p v-else>
        暂无游戏，快来上传第一个游戏吧！
      </p>
      <router-link to="/upload" class="btn-primary">上传游戏</router-link>
    </div>
    
    <div v-else>
      <div class="game-list-header">
        <div class="sort-section">
          <label for="sort-select" class="sort-label">排序：</label>
          <select 
            id="sort-select"
            v-model="sortBy"
            class="sort-select"
            aria-label="排序方式"
          >
            <option 
              v-for="sort in sortOptions" 
              :key="sort.id" 
              :value="sort.id"
            >
              {{ sort.name }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="game-grid">
        <GameCard 
          v-for="game in filteredGames" 
          :key="game.id" 
          :game="game" 
        />
      </div>
    </div>
    
    <div v-if="!isLoading && filteredGames.length > 0" class="game-stats">
      <p class="stats-text">
        共找到 <strong>{{ filteredGames.length }}</strong> 款游戏
        <span v-if="searchQuery || selectedCategory !== 'all'">
          （总共 <strong>{{ gameStore.allGames.length }}</strong> 款）
        </span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.game-library {
  padding-bottom: 2rem;
}

.library-header {
  text-align: center;
  margin-bottom: 2rem;
}

.library-header h1 {
  margin-bottom: 0.5rem;
}

.library-header p {
  color: var(--color-text-secondary);
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
}

.search-bar {
  flex: 1;
  min-width: 200px;
}

.search-bar input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-bar input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.category-filter {
  width: 180px;
  flex-shrink: 0;
}

.category-filter select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 1rem;
  background-color: white;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 1em;
}

.category-filter select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.game-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem;
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

.game-stats {
  margin-top: 2rem;
  text-align: center;
  padding: 1rem;
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.stats-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.stats-text strong {
  color: var(--color-text);
  font-weight: 600;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .search-bar {
    min-width: auto;
    width: 100%;
  }
  
  .category-filter {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .filters {
    gap: 0.75rem;
  }
  
  .search-bar input {
    padding: 0.625rem 0.875rem;
    font-size: 0.95rem;
  }
  
  .category-filter select {
    padding: 0.625rem 0.875rem;
    font-size: 0.95rem;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .search-bar {
    min-width: 250px;
  }
  
  .category-filter {
    width: 170px;
  }
}

@media (min-width: 1025px) {
  .category-filter {
    width: 200px;
  }
}

@media (prefers-color-scheme: dark) {
  .search-bar input,
  .category-filter select {
    background-color: var(--color-surface-dark);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-dark);
  }
  
  .loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--color-primary);
  }
  
  .game-stats {
    background: var(--color-surface-dark);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .sort-label {
    color: var(--color-text-dark);
  }
  
  .sort-select {
    background-color: var(--color-surface-dark);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-dark);
  }
}

.game-list-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 0.75rem 0;
}

.sort-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  margin: 0;
}

.sort-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: white;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 0.8em;
  min-width: 140px;
  transition: all 0.2s;
}

.sort-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.sort-select:hover {
  border-color: var(--color-primary);
}
</style>