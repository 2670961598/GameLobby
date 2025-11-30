<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { get } from '../config/api'

const route = useRoute()
const router = useRouter()
const gameId = route.params.id as string
const isLoading = ref(true)
const error = ref('')
const gameTitle = ref('')

// Define proper types
type DifficultyKey = 'easy' | 'medium' | 'hard'
type LeaderboardData = Record<DifficultyKey, { name: string; score: number }[]>

const leaderboardData = ref<LeaderboardData | null>(null)
const selectedDifficulty = ref<DifficultyKey>('medium')

const difficultyLabels: Record<DifficultyKey, string> = {
  easy: 'Easy',
  medium: 'Medium', 
  hard: 'Hard'
}

onMounted(async () => {
  try {
    await fetchGameInfo()
    await fetchLeaderboard()
  } catch (err) {
    error.value = 'Failed to load leaderboard'
    console.error(err)
  } finally {
    isLoading.value = false
  }
})

const fetchGameInfo = async () => {
  try {
    const response = await get(`/api/games/${gameId}`)
    if (response.ok) {
      const data = await response.json()
      gameTitle.value = data.game.title
    } else {
      gameTitle.value = gameId
    }
  } catch (err) {
    console.error('Failed to fetch game info:', err)
    gameTitle.value = gameId
  }
}

const fetchLeaderboard = async () => {
  try {
    const response = await get(`/api/leaderboard/${gameId}`)
    if (response.ok) {
      const data = await response.json()
      leaderboardData.value = data.leaderboard
      
      // Auto-select difficulty with most players
      const difficulties = Object.keys(data.leaderboard) as DifficultyKey[]
      let maxPlayers = 0
      let bestDiff: DifficultyKey = 'medium'
      
      for (const diff of difficulties) {
        const players = data.leaderboard[diff].length
        if (players > maxPlayers) {
          maxPlayers = players
          bestDiff = diff
        }
      }
      
      selectedDifficulty.value = bestDiff
    } else {
      throw new Error('Failed to fetch leaderboard')
    }
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err)
    throw err
  }
}

const goBack = () => {
  router.go(-1)
}

const goToGame = () => {
  router.push(`/game/${gameId}`)
}

const playGame = () => {
  router.push(`/play/${gameId}`)
}
</script>

<template>
  <div class="leaderboard-page">
    <div class="container">
      <div class="page-header">
        <div class="breadcrumbs">
          <button @click="goBack" class="back-button">
            <span>←</span> Back
          </button>
          <span class="separator">›</span>
          <router-link to="/games">Games</router-link>
          <span class="separator">›</span>
          <button @click="goToGame" class="link-button">{{ gameTitle }}</button>
          <span class="separator">›</span>
          <span>Leaderboard</span>
        </div>
        <h1>{{ gameTitle }} - Leaderboard</h1>
        <div class="page-actions">
          <button @click="playGame" class="btn-primary">Play Game</button>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading leaderboard...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="goBack" class="btn-secondary">Go Back</button>
      </div>

      <template v-else-if="leaderboardData">
        <div class="difficulty-tabs">
          <button 
            v-for="(label, difficulty) in difficultyLabels" 
            :key="difficulty"
            :class="['tab-button', { active: selectedDifficulty === difficulty }]"
            @click="selectedDifficulty = difficulty as DifficultyKey"
          >
            {{ label }}
            <span class="player-count">({{ leaderboardData[difficulty as DifficultyKey]?.length || 0 }})</span>
          </button>
        </div>

        <div class="leaderboard-section">
          <div v-if="leaderboardData[selectedDifficulty] && leaderboardData[selectedDifficulty].length > 0" class="leaderboard-table">
            <div class="table-header">
              <div class="rank-col">Rank</div>
              <div class="name-col">Player</div>
              <div class="score-col">Score</div>
            </div>
            <div class="table-body">
              <div 
                v-for="(player, index) in leaderboardData[selectedDifficulty]" 
                :key="index"
                class="table-row"
                :class="{ 'top-rank': index < 3 }"
              >
                <div class="rank-col">
                  <span class="rank-number" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
                  <span v-if="index === 0" class="rank-icon">🥇</span>
                  <span v-else-if="index === 1" class="rank-icon">🥈</span>
                  <span v-else-if="index === 2" class="rank-icon">🥉</span>
                </div>
                <div class="name-col">{{ player.name }}</div>
                <div class="score-col">{{ player.score.toLocaleString() }}</div>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-leaderboard">
            <div class="empty-icon">🏆</div>
            <h3>No scores yet</h3>
            <p>Be the first to set a high score in {{ difficultyLabels[selectedDifficulty] }} mode!</p>
            <button @click="playGame" class="btn-primary">Play Now</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-page {
  min-height: 80vh;
  padding: 2rem 0;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.breadcrumbs a,
.link-button {
  color: var(--color-text-secondary);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-size: inherit;
}

.breadcrumbs a:hover,
.link-button:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: inherit;
}

.back-button:hover {
  color: var(--color-primary);
}

.separator {
  color: var(--color-text-secondary);
}

h1 {
  margin: 0 0 1rem 0;
  font-size: 2rem;
}

.page-actions {
  display: flex;
  gap: 1rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-secondary {
  background-color: white;
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-secondary:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.difficulty-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-secondary);
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab-button:hover {
  color: var(--color-text);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.player-count {
  font-size: 0.75rem;
  opacity: 0.7;
}

.leaderboard-table {
  background: var(--color-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.table-header {
  display: grid;
  grid-template-columns: 80px 1fr 120px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

.table-body {
  max-height: 600px;
  overflow-y: auto;
}

.table-row {
  display: grid;
  grid-template-columns: 80px 1fr 120px;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.table-row.top-rank {
  background-color: rgba(255, 215, 0, 0.1);
}

.rank-col {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.rank-number {
  min-width: 1.5rem;
}

.rank-1 { color: #FFD700; }
.rank-2 { color: #C0C0C0; }
.rank-3 { color: #CD7F32; }

.rank-icon {
  font-size: 1.25rem;
}

.name-col {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.score-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-weight: 600;
  color: var(--color-primary);
}

.empty-leaderboard {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-leaderboard h3 {
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.empty-leaderboard p {
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.loading-state,
.error-state {
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

@media (max-width: 768px) {
  .table-header,
  .table-row {
    grid-template-columns: 60px 1fr 100px;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }
  
  .breadcrumbs {
    font-size: 0.75rem;
  }
  
  h1 {
    font-size: 1.5rem;
  }
  
  .difficulty-tabs {
    flex-wrap: wrap;
  }
  
  .tab-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
}

@media (prefers-color-scheme: dark) {
  .table-row:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }
  
  .table-row.top-rank {
    background-color: rgba(255, 215, 0, 0.15);
  }
  
  .table-row {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }
  
  .difficulty-tabs {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
  
  .loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--color-primary);
  }
}
</style> 