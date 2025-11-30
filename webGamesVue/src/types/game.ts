/**
 * Type definitions for game-related data
 */

export interface Game {
  id: string
  title: string
  description: string
  thumbnailUrl?: string
  url?: string
  category: string
  isOfflineAvailable: boolean
  playerCount?: number
  controls?: string
  version?: string
  author?: string
  size?: number
  clicks?: number
  timestamp?: string
  // Game configuration
  maxPlayers: number
  minPlayers: number
  gameType: 'single' | 'multiplayer' | 'coop'
}

export interface GameFile {
  gameId: string
  path: string
  data: Blob
}

export interface LeaderboardEntry {
  id: string
  gameId: string
  userId: string
  username: string
  score: number
  timestamp: number
}

export interface GameCategory {
  id: string
  name: string
  description?: string
}