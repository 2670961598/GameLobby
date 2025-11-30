/**
 * Service for handling game-related operations
 */

import type { Game } from '../../../types/game'
import { initGameDatabase } from './gameStorageService'
import { apiRequest } from '../../../config/api'

/**
 * Process image URL to ensure it works in both dev and production modes
 */
const processImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return ''
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // 使用相对路径，在开发和生产模式下都能正常工作
  // 开发模式：Vite会自动代理
  // 生产模式：Vue应用和Flask服务器在同一域名下
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
}

/**
 * Fetch featured games from the API (热门游戏 - 大家在玩)
 */
export const fetchFeaturedGames = async (): Promise<Game[]> => {
  try {
    const response = await apiRequest('/api/games/featured')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    
    // Transform API data to our Game interface
    return data.games.map((game: any) => ({
      id: game.id,
      title: game.title,
      description: game.description,
      thumbnailUrl: processImageUrl(game.preview),
      category: game.category,
      isOfflineAvailable: false, // For now, assume all games require internet
      playerCount: 1, // Default single player
      controls: game.controls,
      author: game.author,
      clicks: game.clicks,
      timestamp: game.timestamp,
      // Game configuration from API
      maxPlayers: game.maxPlayers || 2,
      minPlayers: game.minPlayers || 1,
      gameType: game.gameType || 'multiplayer'
    }))
  } catch (error) {
    console.error('Failed to fetch featured games:', error)
    
    // Fallback to mock data if API fails
    return [
      {
        id: 'game1',
        title: 'Space Shooter',
        description: 'Classic arcade-style space shooter game with multiple levels and power-ups.',
        thumbnailUrl: 'https://images.pexels.com/photos/2510067/pexels-photo-2510067.jpeg?auto=compress&cs=tinysrgb&w=600',
        category: 'action',
        isOfflineAvailable: true,
        playerCount: 1,
        controls: 'Use arrow keys to move, space to shoot',
        author: 'Demo',
        clicks: 123,
        timestamp: '2025-01-01 00:00:00',
        maxPlayers: 1,
        minPlayers: 1,
        gameType: 'single' as const
      }
    ]
  }
}

/**
 * Fetch recent games from the API (最近上新)
 */
export const fetchRecentGames = async (): Promise<Game[]> => {
  try {
    const response = await apiRequest('/api/games/recent')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    
    // Transform API data to our Game interface
    return data.games.map((game: any) => ({
      id: game.id,
      title: game.title,
      description: game.description,
      thumbnailUrl: processImageUrl(game.preview),
      category: game.category,
      isOfflineAvailable: false, // For now, assume all games require internet
      playerCount: 1, // Default single player
      controls: game.controls,
      author: game.author,
      clicks: game.clicks,
      timestamp: game.timestamp,
      // Game configuration from API
      maxPlayers: game.maxPlayers || 2,
      minPlayers: game.minPlayers || 1,
      gameType: game.gameType || 'multiplayer'
    }))
  } catch (error) {
    console.error('Failed to fetch recent games:', error)
    
    // Fallback to empty array if API fails
    return []
  }
}

/**
 * Fetch all games from the API
 */
export const fetchAllGames = async (): Promise<Game[]> => {
  try {
    const response = await apiRequest('/api/games')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    
    // Transform API data to our Game interface
    return data.games.map((game: any) => ({
      id: game.id,
      title: game.title,
      description: game.description,
      thumbnailUrl: processImageUrl(game.preview),
      category: game.category,
      isOfflineAvailable: false, // For now, assume all games require internet
      playerCount: 1, // Default single player
      controls: game.controls,
      author: game.author,
      clicks: game.clicks,
      timestamp: game.timestamp,
      // Game configuration from API
      maxPlayers: game.maxPlayers || 2,
      minPlayers: game.minPlayers || 1,
      gameType: game.gameType || 'multiplayer'
    }))
  } catch (error) {
    console.error('Failed to fetch all games:', error)
    
    // Fallback to featured games if API fails
    return await fetchFeaturedGames()
  }
}

/**
 * Fetch a specific game by ID
 */
export const fetchGameById = async (id: string): Promise<Game | null> => {
  try {
    const response = await apiRequest(`/api/games/${id}`)
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    const game = data.game
    
    // Transform API data to our Game interface
    return {
      id: game.id,
      title: game.title,
      description: game.description,
      thumbnailUrl: processImageUrl(game.preview),
      category: game.category,
      isOfflineAvailable: false,
      playerCount: 1,
      controls: game.controls,
      author: game.author,
      url: game.gameUrl,
      clicks: game.clicks,
      timestamp: game.timestamp,
      // Game configuration from API
      maxPlayers: game.maxPlayers || 2,
      minPlayers: game.minPlayers || 1,
      gameType: game.gameType || 'multiplayer'
    }
  } catch (error) {
    console.error(`Failed to fetch game ${id}:`, error)
    return null
  }
}

/**
 * Save game to local storage
 */
export const saveGameToCache = async (game: Game): Promise<void> => {
  try {
    const db = await initGameDatabase()
    await db.games.put(game)
    
    // In a real implementation, we would also cache game files here
    console.log(`Game ${game.id} saved to cache`)
  } catch (error) {
    console.error('Failed to save game to cache:', error)
    throw error
  }
}

/**
 * Check if a game is available in the cache
 */
export const isGameCached = async (gameId: string): Promise<boolean> => {
  try {
    const db = await initGameDatabase()
    const game = await db.games.get(gameId)
    return !!game
  } catch (error) {
    console.error('Failed to check game cache:', error)
    return false
  }
}