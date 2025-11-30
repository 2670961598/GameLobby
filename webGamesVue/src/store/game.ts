import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Game } from '../types/game'
import { 
  fetchFeaturedGames,
  fetchRecentGames,
  fetchAllGames,
  fetchGameById,
  saveGameToCache,
  isGameCached
} from '../modules/game/services/gameService'

export const useGameStore = defineStore('game', () => {
  // State
  const featuredGames = ref<Game[]>([])
  const recentGames = ref<Game[]>([])
  const allGames = ref<Game[]>([])
  const currentGame = ref<Game | null>(null)
  const loadingGame = ref(false)
  const gameError = ref<string | null>(null)

  // Actions
  const fetchFeatured = async () => {
    try {
      featuredGames.value = await fetchFeaturedGames()
      return featuredGames.value
    } catch (error) {
      console.error('Failed to fetch featured games:', error)
      return []
    }
  }

  const fetchAll = async () => {
    try {
      allGames.value = await fetchAllGames()
      return allGames.value
    } catch (error) {
      console.error('Failed to fetch all games:', error)
      return []
    }
  }

  const fetchRecent = async () => {
    try {
      recentGames.value = await fetchRecentGames()
      return recentGames.value
    } catch (error) {
      console.error('Failed to fetch recent games:', error)
      return []
    }
  }

  const loadGame = async (id: string) => {
    loadingGame.value = true
    gameError.value = null
    
    try {
      // Try to get the game from our store first
      let game = allGames.value.find(g => g.id === id)
      
      // If not found, fetch it from the API
      if (!game) {
        const fetchedGame = await fetchGameById(id)
        if (fetchedGame) {
          game = fetchedGame
        }
      }
      
      if (!game) {
        gameError.value = 'Game not found'
        currentGame.value = null
        return null
      }
      
      // Save the current game
      currentGame.value = game
      
      // Check if game is available offline and cache if needed
      const isCached = await isGameCached(game.id)
      if (!isCached && game.isOfflineAvailable) {
        await saveGameToCache(game)
      }
      
      return game
    } catch (error) {
      console.error(`Failed to load game ${id}:`, error)
      gameError.value = 'Failed to load game'
      return null
    } finally {
      loadingGame.value = false
    }
  }

  return {
    // State
    featuredGames,
    recentGames,
    allGames,
    currentGame,
    loadingGame,
    gameError,
    
    // Actions
    fetchFeaturedGames: fetchFeatured,
    fetchAllGames: fetchAll,
    fetchRecentGames: fetchRecent,
    loadGame
  }
})