/**
 * Service for managing local storage of games using IndexedDB
 */

import Dexie from 'dexie'
import type { Game } from '../../../types/game'

// Define the database
class GameDatabase extends Dexie {
  games: Dexie.Table<Game, string>
  gameFiles: Dexie.Table<{id: string, gameId: string, path: string, blob: Blob}, string>

  constructor() {
    super('GamePlatformDB')
    
    // Define tables and their primary keys
    this.version(1).stores({
      games: 'id, title, category',
      gameFiles: 'id, gameId, path'
    })
    
    // Define typed tables
    this.games = this.table('games')
    this.gameFiles = this.table('gameFiles')
  }
}

// Database singleton
let db: GameDatabase | null = null

/**
 * Initialize the game database
 */
export const initGameDatabase = async (): Promise<GameDatabase> => {
  if (!db) {
    db = new GameDatabase()
    
    // Verify the connection works
    await db.open()
    console.log('Game database initialized')
  }
  
  return db
}

/**
 * Store game files in IndexedDB
 * 
 * @param gameId The ID of the game
 * @param files Object mapping file paths to Blobs/Files
 */
export const storeGameFiles = async (
  gameId: string, 
  files: Record<string, Blob>
): Promise<void> => {
  const db = await initGameDatabase()
  
  // Start a transaction
  await db.transaction('rw', db.gameFiles, async () => {
    // Delete any existing files for this game
    await db.gameFiles.where('gameId').equals(gameId).delete()
    
    // Add new files
    for (const [path, blob] of Object.entries(files)) {
      await db.gameFiles.add({
        id: `${gameId}_${path}`,
        gameId,
        path,
        blob
      })
    }
  })
  
  console.log(`Stored ${Object.keys(files).length} files for game ${gameId}`)
}

/**
 * Retrieve a game file from cache
 * 
 * @param gameId The ID of the game
 * @param path The file path
 */
export const getGameFile = async (
  gameId: string,
  path: string
): Promise<Blob | null> => {
  const db = await initGameDatabase()
  
  const fileEntry = await db.gameFiles.get(`${gameId}_${path}`)
  return fileEntry?.blob || null
}

/**
 * Delete a game and all its files from cache
 * 
 * @param gameId The ID of the game
 */
export const deleteGameFromCache = async (gameId: string): Promise<void> => {
  const db = await initGameDatabase()
  
  await db.transaction('rw', [db.games, db.gameFiles], async () => {
    await db.games.delete(gameId)
    await db.gameFiles.where('gameId').equals(gameId).delete()
  })
  
  console.log(`Game ${gameId} deleted from cache`)
}

/**
 * Get the cache size for a specific game
 * 
 * @param gameId The ID of the game
 */
export const getGameCacheSize = async (gameId: string): Promise<number> => {
  const db = await initGameDatabase()
  
  const files = await db.gameFiles.where('gameId').equals(gameId).toArray()
  
  let totalSize = 0
  for (const file of files) {
    totalSize += file.blob.size
  }
  
  return totalSize
}

/**
 * List all cached games
 */
export const listCachedGames = async (): Promise<Game[]> => {
  const db = await initGameDatabase()
  return db.games.toArray()
}