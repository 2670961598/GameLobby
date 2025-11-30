/**
 * Service for handling platform API communication with games in sandboxes
 */

/**
 * Platform API methods that will be exposed to games running in the sandbox
 */
const createPlatformAPI = (gameId: string) => {
  return {
    // Submit score to the platform
    submitScore: (score: number, leaderboardId?: string) => {
      console.log(`Game ${gameId} submitted score: ${score} to leaderboard: ${leaderboardId || 'default'}`)
      // In a real implementation, this would call a backend API
      return { success: true }
    },
    
    // Get the current user information
    getUser: () => {
      // In a real implementation, this would get user from store
      return { 
        id: 'user123', 
        name: 'Player', 
        isGuest: true 
      }
    },
    
    // Get the game leaderboard
    getLeaderboard: async (leaderboardId?: string) => {
      console.log(`Game ${gameId} requested leaderboard: ${leaderboardId || 'default'}`)
      // Mock leaderboard data - would be fetched from backend
      return [
        { rank: 1, name: 'Player1', score: 1000 },
        { rank: 2, name: 'Player2', score: 850 },
        { rank: 3, name: 'Player3', score: 720 }
      ]
    },
    
    // Send a message to the platform
    sendMessage: (type: string, data: any) => {
      console.log(`Game ${gameId} sent message: ${type}`, data)
      return { received: true }
    },
    
    // Log an event or error
    logEvent: (event: string, data?: any) => {
      console.log(`Game ${gameId} event: ${event}`, data)
    }
  }
}

/**
 * Injects the Platform API into an iframe
 */
export const injectPlatformAPI = (iframe: HTMLIFrameElement, gameId: string) => {
  if (!iframe.contentWindow) {
    throw new Error('Iframe content window not available')
  }
  
  // Create the API object
  const api = createPlatformAPI(gameId)
  
  // Method 1: Post message approach (more secure)
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return
    
    const { cmd, args = [], callId } = event.data || {}
    
    if (!cmd || !(cmd in api)) return
    
    try {
      // Type-safe property access
      const apiMethod = api[cmd as keyof typeof api]
      if (typeof apiMethod === 'function') {
        const result = (apiMethod as any)(...args)
        
        // Send the result back to the iframe
        if (callId) {
          iframe.contentWindow?.postMessage({
            type: 'platform-api-response',
            callId,
            result
          }, '*')
        }
      }
    } catch (error) {
      console.error(`Error executing API command ${cmd}:`, error)
      
      if (callId) {
        iframe.contentWindow?.postMessage({
          type: 'platform-api-error',
          callId,
          error: 'API execution error'
        }, '*')
      }
    }
  })
  
  // Inject a script into the iframe that sets up the client-side API
  try {
    const script = `
      // Platform API Client
      window.PlatformAPI = new Proxy({}, {
        get(target, prop) {
          return (...args) => {
            return new Promise((resolve, reject) => {
              const callId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
              
              // Listen for the response
              const messageHandler = (event) => {
                if (event.data && event.data.callId === callId) {
                  window.removeEventListener('message', messageHandler);
                  
                  if (event.data.type === 'platform-api-error') {
                    reject(new Error(event.data.error));
                  } else {
                    resolve(event.data.result);
                  }
                }
              };
              
              window.addEventListener('message', messageHandler);
              
              // Send the request to the parent
              window.parent.postMessage({
                cmd: prop,
                args: args,
                callId: callId
              }, '*');
              
              // Timeout after 5 seconds
              setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('API call timed out'));
              }, 5000);
            });
          };
        }
      });
      
      // Notify platform that the game is ready
      window.parent.postMessage({ cmd: 'gameLoaded' }, '*');
      
      console.log('Platform API initialized');
    `;
    
    // Add the script to the iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) return
    
    const scriptEl = iframeDoc.createElement('script')
    scriptEl.textContent = script
    
    if (iframeDoc.readyState === 'complete' || iframeDoc.readyState === 'interactive') {
      iframeDoc.body.appendChild(scriptEl)
    } else {
      iframe.addEventListener('load', () => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc) doc.body.appendChild(scriptEl)
      })
    }
  } catch (error) {
    console.error('Error injecting platform API script:', error)
  }
}