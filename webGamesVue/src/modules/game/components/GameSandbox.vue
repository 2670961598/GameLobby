<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Game } from '../../../types/game'
import { injectPlatformAPI } from '../services/platformApiService'

const props = defineProps<{
  game: Game
}>()

const route = useRoute()
const iframeRef = ref<HTMLIFrameElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)

// Listen for messages from the iframe
const handleMessage = (event: MessageEvent) => {
  if (!iframeRef.value || event.source !== iframeRef.value.contentWindow) {
    return // Ignore messages from other sources
  }
  
  // Process messages from the game
  const { cmd, data } = event.data
  
  switch (cmd) {
    case 'submitScore':
      console.log('Game submitted score:', data.score)
      // TODO: Handle score submission
      break
    case 'gameLoaded':
      isLoading.value = false
      break
    // Add more command handlers as needed
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
  
  if (iframeRef.value) {
    iframeRef.value.addEventListener('load', handleIframeLoad)
    iframeRef.value.addEventListener('error', handleIframeError)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
  
  if (iframeRef.value) {
    iframeRef.value.removeEventListener('load', handleIframeLoad)
    iframeRef.value.removeEventListener('error', handleIframeError)
  }
})

const handleIframeLoad = () => {
  isLoading.value = false
  
  // Inject platform API into the iframe
  if (iframeRef.value) {
    try {
      injectPlatformAPI(iframeRef.value, props.game.id)
    } catch (err) {
      console.error('Failed to inject platform API:', err)
    }
  }
}

const handleIframeError = () => {
  isLoading.value = false
  hasError.value = true
}

// Construct the game URL correctly
const gameUrl = computed(() => {
  const url = new URL(`/game/${props.game.id}/`, window.location.origin)
  
  if (route.query.room) {
    console.log('检测到房间参数，加入指定房间:', route.query.room)
    url.searchParams.set('room', route.query.room as string)
  } else {
    console.log('没有房间参数，将创建新房间')
  }
  
  if (route.query.spectator) {
    console.log('检测到观战参数，以观战模式进入:', route.query.spectator)
    url.searchParams.set('spectator', route.query.spectator as string)
  }
  
  console.log('游戏URL:', url.toString())
  return url.toString()
})

const retryLoad = () => {
  isLoading.value = true
  hasError.value = false
  
  // Force iframe reload
  if (iframeRef.value) {
    iframeRef.value.src = gameUrl.value
  }
}
</script>

<template>
  <div class="game-sandbox" :class="{ 'is-loading': isLoading }">
    <div v-if="isLoading" class="sandbox-overlay loading">
      <div class="loading-spinner"></div>
      <p>Loading game...</p>
    </div>
    
    <div v-if="hasError" class="sandbox-overlay error">
      <p>Failed to load the game</p>
      <button @click="retryLoad" class="retry-button">
        Retry
      </button>
    </div>
    
    <iframe
      ref="iframeRef"
      :src="gameUrl"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock"
      allow="autoplay; fullscreen"
      frameborder="0"
      scrolling="no"
      title="Game Sandbox"
    ></iframe>
  </div>
</template>

<style scoped>
.game-sandbox {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #000;
  overflow: hidden;
}

iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.sandbox-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 10;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255, 255, 255, 0.1);
  border-left-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: var(--color-primary-dark);
}
</style>