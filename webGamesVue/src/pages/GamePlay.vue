<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../store/game'
import GameSandbox from '../modules/game/components/GameSandbox.vue'

// 统一的键盘事件监听选项，需在绑定和解绑时保持一致
const KEY_EVENT_LISTENER_OPTIONS = { capture: true, passive: false } as const

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const gameId = route.params.id as string
const isLoading = ref(true)
const error = ref('')
const isFullscreen = ref(false)
const shareMessage = ref('')
const showShareMessage = ref(false)
const gameContainerRef = ref<HTMLElement | null>(null)
const gameSandboxRef = ref<InstanceType<typeof GameSandbox> | null>(null)
// 游戏是否处于激活状态（决定是否拦截按键/滚轮等）
const isGameActive = ref(false)

onMounted(async () => {
  try {
    await gameStore.loadGame(gameId)
    if (!gameStore.currentGame) {
      error.value = 'Game not found'
    }
  } catch (err) {
    error.value = 'Failed to load the game'
    console.error(err)
  } finally {
    isLoading.value = false
  }
  
  // Listen for fullscreen change events
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  
  // 使用与解绑完全一致的参数对象，确保移除成功
  document.addEventListener('keydown', handleGlobalKeydown, KEY_EVENT_LISTENER_OPTIONS)
  document.addEventListener('keyup', handleGlobalKeyup, KEY_EVENT_LISTENER_OPTIONS)
  
  // 在捕获阶段监听全局滚轮，必要时阻止页面滚动
  document.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false })
  
  // 全局点击监听，用于检测是否点击到游戏区域外以取消激活
  document.addEventListener('click', handleDocumentClick, { capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', handleGlobalKeydown, KEY_EVENT_LISTENER_OPTIONS)
  document.removeEventListener('keyup', handleGlobalKeyup, KEY_EVENT_LISTENER_OPTIONS)
  
  if (gameContainerRef.value) {
    gameContainerRef.value.removeEventListener('wheel', handleGameAreaWheel)
  }

  document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('wheel', handleGlobalWheel, true)

  // 确保离开页面时解除滚动锁
  unlockPageScroll()
})

// 获取游戏 iframe 并尝试聚焦（同源时生效）
const focusGameIframe = () => {
  nextTick(() => {
    const iframe = gameContainerRef.value?.querySelector('iframe') as HTMLIFrameElement
    if (iframe) {
      try {
        iframe.focus()
        if (iframe.contentWindow) {
          iframe.contentWindow.focus()
        }
      } catch (err) {
        console.debug('Cannot focus iframe due to cross-origin restrictions')
      }
    }
  })
}

// 激活 / 取消激活逻辑
const lockPageScroll = () => {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

const unlockPageScroll = () => {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

const activateGame = () => {
  if (!isGameActive.value) {
    isGameActive.value = true
    lockPageScroll()
  }
  // 确保容器获得焦点，随后尝试聚焦 iframe
  if (gameContainerRef.value) {
    gameContainerRef.value.focus()
  }
  focusGameIframe()
}

const deactivateGame = () => {
  if (isGameActive.value) {
    isGameActive.value = false
    unlockPageScroll()
  }
}

// 优雅的键盘事件拦截 - 只在游戏激活时拦截导航/滚动相关按键
// 使用 event.code 以获得更一致的跨浏览器体验
const PAGE_NAVIGATION_CODES = new Set<string>([
  'Space',       // 空格滚动
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',   // 某些游戏可能不需要，但左右键也会导致页面横向滚动（如果存在）
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Tab',         // Tab 切换焦点
  'Escape'       // 允许 Esc 退出激活
])

const handleGlobalKeydown = (event: KeyboardEvent) => {
  // 仅当游戏处于激活状态时才拦截
  if (!isGameActive.value) return

  // 处理 F11 切换全屏
  if (event.code === 'F11') {
    event.preventDefault()
    event.stopPropagation()
    toggleFullscreen()
    return
  }

  // 统一使用 event.code 进行判断
  if (PAGE_NAVIGATION_CODES.has(event.code)) {
    event.preventDefault()
    event.stopPropagation() // 阻止事件再向上冒泡，避免干扰宿主页其他监听
  }

  // Esc 退出激活
  if (event.code === 'Escape') {
    deactivateGame()
    return
  }
}

const handleGlobalKeyup = (event: KeyboardEvent) => {
  if (!isGameActive.value) return

  if (PAGE_NAVIGATION_CODES.has(event.code)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

// 游戏区域内的滚轮事件处理
const handleGameAreaWheel = (event: WheelEvent) => {
  if (isGameActive.value) {
    // 只阻止页面滚动，不阻止事件传播给游戏
    event.preventDefault()
  }
}

// 文档级点击，用于激活/取消激活游戏
const handleDocumentClick = (event: MouseEvent) => {
  if (!gameContainerRef.value) return
  const target = event.target as Node
  if (gameContainerRef.value.contains(target)) {
    activateGame()
  } else {
    deactivateGame()
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

const toggleFullscreen = async () => {
  try {
    if (!isFullscreen.value) {
      const gameContainer = document.querySelector('.game-container') as HTMLElement
      if (gameContainer && gameContainer.requestFullscreen) {
        await gameContainer.requestFullscreen()
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.error('Fullscreen error:', err)
  }
}

const goBack = () => {
  router.back()
}

// 分享游戏功能
const shareGame = async () => {
  try {
    // 获取当前完整URL，保持路由模式和路径的一致性
    const gameLink = window.location.href
    
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(gameLink)
      showShareFeedback('游戏链接已复制到剪贴板！', 'success')
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = gameLink
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        document.execCommand('copy')
        showShareFeedback('游戏链接已复制到剪贴板！', 'success')
      } catch (err) {
        showShareFeedback('复制失败，请手动复制链接', 'error')
        console.error('复制失败:', err)
      } finally {
        document.body.removeChild(textArea)
      }
    }
  } catch (err) {
    showShareFeedback('复制失败，请稍后重试', 'error')
    console.error('分享失败:', err)  
  }
}

// 显示分享反馈消息
const showShareFeedback = (message: string, _type: 'success' | 'error') => {
  shareMessage.value = message
  showShareMessage.value = true
  
  setTimeout(() => {
    showShareMessage.value = false
  }, 3000)
}

// 查看排行榜功能
const viewLeaderboard = () => {
  if (gameStore.currentGame) {
    router.push(`/leaderboard/${gameStore.currentGame.id}`)
  }
}

// 失焦处理：仅当新的 activeElement 不在游戏容器内时才取消激活
const handleGameContainerBlur = () => {
  setTimeout(() => {
    const activeEl = document.activeElement
    if (gameContainerRef.value && !gameContainerRef.value.contains(activeEl)) {
      deactivateGame()
    }
  }, 0)
}

// 全局滚轮处理
const handleGlobalWheel = (event: WheelEvent) => {
  if (!isGameActive.value) return
  // 若滚轮事件来源于游戏容器（或其子元素/iframe），阻止默认滚动
  if (gameContainerRef.value && gameContainerRef.value.contains(event.target as Node)) {
    event.preventDefault()
  }
}
</script>

<template>
  <div class="game-play">
    <!-- 分享消息提示 -->
    <div v-if="showShareMessage" class="share-notification" :class="{ 'success': shareMessage.includes('已复制'), 'error': !shareMessage.includes('已复制') }">
      <span class="notification-icon">{{ shareMessage.includes('已复制') ? '✓' : '⚠' }}</span>
      <span class="notification-text">{{ shareMessage }}</span>
    </div>
    
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading game...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="goBack" class="btn-secondary">Go Back</button>
    </div>
    
    <template v-else-if="gameStore.currentGame">
      <div class="game-header">
        <button @click="goBack" class="back-button">
          <span>←</span> Back
        </button>
        <h1>{{ gameStore.currentGame.title }}</h1>
        <button @click="toggleFullscreen" class="fullscreen-button">
          {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
        </button>
      </div>
      
      <div 
        ref="gameContainerRef"
        class="game-container" 
        :class="{ 
          'is-fullscreen': isFullscreen,
          'is-focused': isGameActive
        }"
        tabindex="0"
        @focus="activateGame"
        @blur="handleGameContainerBlur"
        @click="activateGame"
      >
        <GameSandbox ref="gameSandboxRef" :game="gameStore.currentGame" />
        
        <!-- 游戏焦点提示 -->
        <div v-if="isGameActive && !isFullscreen" class="focus-indicator">
          <span class="focus-text">Game Active</span>
        </div>
        
        <!-- 点击提示覆盖层 -->
        <div v-if="!isGameActive && !isFullscreen" class="click-hint-overlay">
          <div class="click-hint">
            <span class="hint-icon">🎮</span>
            <span class="hint-text">Click to activate game controls</span>
            <small class="hint-subtext">Arrow keys and space will be captured</small>
          </div>
        </div>
      </div>
      
      <div v-if="!isFullscreen" class="game-controls">
        <div class="control-section">
          <h3>Controls</h3>
          <p>{{ gameStore.currentGame.controls || 'Use keyboard and mouse to play.' }}</p>
          <div class="input-tip">
            <span class="tip-icon">💡</span>
            <span>Click on the game area to activate keyboard controls. Page scrolling will be prevented only while the game is active.</span>
          </div>
        </div>
        <div class="actions-section">
          <button class="btn-primary" @click="shareGame">
            <span class="btn-icon">🔗</span>
            Share Game
          </button>
          <button class="btn-secondary" @click="viewLeaderboard">
            <span class="btn-icon">🏆</span>
            View Leaderboard
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.game-play {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.share-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  animation: slideInFromRight 0.3s ease-out;
  backdrop-filter: blur(10px);
}

.share-notification.success {
  background-color: rgba(16, 185, 129, 0.9);
  color: white;
}

.share-notification.error {
  background-color: rgba(239, 68, 68, 0.9);
  color: white;
}

.notification-icon {
  font-size: 1.1rem;
  font-weight: bold;
}

.notification-text {
  font-size: 0.9rem;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.back-button,
.fullscreen-button {
  background: none;
  border: none;
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.back-button:hover,
.fullscreen-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.game-header h1 {
  margin: 0;
  font-size: 1.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 响应式游戏容器，保持 16:9 比例，介于 min-height 与视口 85vh 之间 */
.game-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  max-height: 85vh;
  min-height: 360px; /* 设置一个合理的最小高度，防止过小 */
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  outline: none;
  transition: all 0.15s ease;
  cursor: pointer;
}

.game-container:focus,
.game-container.is-focused {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.6), 0 4px 10px rgba(0, 0, 0, 0.1);
  cursor: default;
}

.game-container.hover-hint:not(.is-focused) {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3), 0 4px 10px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.game-container.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  border-radius: 0;
  min-height: auto;
  box-shadow: none;
}

.focus-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(16, 185, 129, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  z-index: 20;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(10px);
  animation: fadeInScale 0.3s ease-out;
}

.focus-text {
  font-size: 0.75rem;
}

.click-hint-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 15;
  backdrop-filter: blur(2px);
}

.click-hint {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  padding: 1.25rem 1.75rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: pulseGlow 2s ease-in-out infinite;
  text-align: center;
}

.hint-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.hint-text {
  font-size: 1rem;
  margin: 0;
}

.hint-subtext {
  font-size: 0.8rem;
  color: #666;
  margin: 0;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 6px 25px rgba(16, 185, 129, 0.3);
  }
}

.input-tip {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(16, 185, 129, 0.1);
  border-left: 3px solid #10b981;
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tip-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.game-controls {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: space-between;
  align-items: flex-start;
}

.control-section {
  flex: 3;
  min-width: 250px;
}

.control-section h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.actions-section {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-icon {
  font-size: 1rem;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
  border: none;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-secondary:hover {
  background-color: rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
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
  .game-header h1 {
    font-size: 1.25rem;
  }
  
  .back-button,
  .fullscreen-button {
    font-size: 0.75rem;
  }
  
  .share-notification {
    top: 10px;
    right: 10px;
    left: 10px;
    font-size: 0.85rem;
  }
  
  .game-container {
    max-height: 75vh;
    min-height: 300px;
  }
  
  .click-hint {
    padding: 1rem 1.25rem;
    font-size: 0.9rem;
  }
}

@media (min-width: 1200px) {
  .game-container {
    max-height: 80vh;
    min-height: 420px;
  }
}

@media (prefers-color-scheme: dark) {
  .back-button:hover,
  .fullscreen-button:hover,
  .btn-secondary:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .btn-secondary {
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--color-primary);
  }
  
  .click-hint {
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
  }
  
  .hint-subtext {
    color: #ccc;
  }
}
</style>