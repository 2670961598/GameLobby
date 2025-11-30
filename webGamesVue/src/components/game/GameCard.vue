<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Game } from '../../types/game'

const props = defineProps<{
  game: Game
}>()

const router = useRouter()

// 拖拽检测相关状态
const mouseDownPosition = ref<{ x: number; y: number } | null>(null)
const isDragging = ref(false)

// 清理函数
const cleanup = () => {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
  document.removeEventListener('touchmove', handleGlobalTouchMove)
  document.removeEventListener('touchend', handleGlobalTouchEnd)
}

onUnmounted(() => {
  cleanup()
})

const thumbnailUrl = computed(() => {
  return props.game.thumbnailUrl || 'https://via.placeholder.com/300x200?text=Game'
})

const truncateDescription = (desc: string, maxLength = 80) => {
  if (desc.length <= maxLength) return desc
  return desc.slice(0, maxLength) + '...'
}

const formatClicks = (clicks?: number) => {
  if (!clicks) return '0'
  if (clicks >= 1000) {
    return `${(clicks / 1000).toFixed(1)}k`
  }
  return clicks.toString()
}

// 处理鼠标按下事件
const handleMouseDown = (event: MouseEvent) => {
  // 如果点击的是按钮或链接，不记录位置
  const target = event.target as HTMLElement
  if (target.closest('.card-actions') || target.closest('a') || target.closest('button')) {
    return
  }
  
  mouseDownPosition.value = { x: event.clientX, y: event.clientY }
  isDragging.value = false
  
  // 添加全局监听器
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)
}

// 全局鼠标移动事件
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (mouseDownPosition.value) {
    const deltaX = Math.abs(event.clientX - mouseDownPosition.value.x)
    const deltaY = Math.abs(event.clientY - mouseDownPosition.value.y)
    
    // 如果移动距离超过5像素，认为是拖拽
    if (deltaX > 5 || deltaY > 5) {
      isDragging.value = true
    }
  }
}

// 全局鼠标松开事件
const handleGlobalMouseUp = () => {
  mouseDownPosition.value = null
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)
}

// 处理触摸开始事件
const handleTouchStart = (event: TouchEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('.card-actions') || target.closest('a') || target.closest('button')) {
    return
  }
  
  const touch = event.touches[0]
  mouseDownPosition.value = { x: touch.clientX, y: touch.clientY }
  isDragging.value = false
  
  document.addEventListener('touchmove', handleGlobalTouchMove)
  document.addEventListener('touchend', handleGlobalTouchEnd)
}

// 全局触摸移动事件
const handleGlobalTouchMove = (event: TouchEvent) => {
  if (mouseDownPosition.value && event.touches[0]) {
    const touch = event.touches[0]
    const deltaX = Math.abs(touch.clientX - mouseDownPosition.value.x)
    const deltaY = Math.abs(touch.clientY - mouseDownPosition.value.y)
    
    if (deltaX > 5 || deltaY > 5) {
      isDragging.value = true
    }
  }
}

// 全局触摸结束事件
const handleGlobalTouchEnd = () => {
  mouseDownPosition.value = null
  document.removeEventListener('touchmove', handleGlobalTouchMove)
  document.removeEventListener('touchend', handleGlobalTouchEnd)
}

// 处理鼠标移动事件（保留用于局部检测）
const handleMouseMove = (_event: MouseEvent) => {
  // 这个函数现在主要用于局部移动检测，全局检测由handleGlobalMouseMove处理
}

// 处理鼠标松开事件（保留用于局部检测）
const handleMouseUp = () => {
  // 局部的mouseup事件处理
}

// 处理卡片点击事件
const handleCardClick = (event: Event) => {
  // 如果刚才发生了拖拽，不执行点击逻辑
  if (isDragging.value) {
    console.log('检测到拖拽，阻止点击事件')
    isDragging.value = false
    return
  }
  
  // 如果点击的是按钮或链接，不执行卡片点击逻辑
  const target = event.target as HTMLElement
  if (target.closest('.card-actions') || target.closest('a') || target.closest('button')) {
    console.log('点击的是按钮或链接，不执行卡片点击')
    return
  }
  
  // 点击卡片其他区域，导航到游戏详情页面
  console.log('导航到游戏详情页面:', `/game/${props.game.id}`)
  router.push(`/game/${props.game.id}`)
}

// 从游戏大厅直接开始游戏（创建新房间）
const playGame = () => {
  console.log('从游戏大厅开始游戏（创建新房间）:', props.game.id)
  console.log('没有传递房间参数，游戏将自动生成新房间')
  router.push(`/play/${props.game.id}`)
}
</script>

<template>
  <div 
    class="game-card" 
    @click="handleCardClick"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @touchstart="handleTouchStart"
  >
    <div class="card-thumbnail">
      <img :src="thumbnailUrl" :alt="game.title">
      <div v-if="game.isOfflineAvailable" class="offline-badge">
        <span>Available Offline</span>
      </div>
    </div>
    <div class="card-content">
      <h3 class="game-title">{{ game.title }}</h3>
      <p class="game-description">{{ truncateDescription(game.description) }}</p>
      <div v-if="game.author" class="game-author">
        <span class="author-label">By</span>
        <span class="author-name">{{ game.author }}</span>
      </div>
      <div v-if="game.clicks !== undefined" class="game-clicks">
        <span class="clicks-icon">👆</span>
        <span class="clicks-count">{{ formatClicks(game.clicks) }} 次点击</span>
      </div>
      <div class="card-meta">
        <span class="game-category">{{ game.category }}</span>
        <span v-if="game.playerCount" class="player-count">{{ game.playerCount }} players</span>
      </div>
      <div class="card-actions">
        <button 
          @click="playGame" 
          class="play-btn"
          @click.stop
        >Play Now</button>
        <router-link 
          :to="`/game/${game.id}`" 
          class="details-btn"
          @click.stop
        >Details</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-card {
  background: var(--color-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s, box-shadow 0.3s;
  height: 100%;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  user-select: none;
}

.game-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.1);
}

.card-thumbnail {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
  pointer-events: none;
}

.game-card:hover .card-thumbnail img {
  transform: scale(1.05);
}

.offline-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(16, 185, 129, 0.9);
  color: white;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  pointer-events: none;
}

.card-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.game-title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  pointer-events: none;
}

.game-description {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  flex-grow: 1;
  pointer-events: none;
}

.game-author {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  pointer-events: none;
}

.author-label {
  color: var(--color-text-secondary);
  font-style: italic;
}

.author-name {
  color: var(--color-primary);
  font-weight: 500;
}

.game-clicks {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  pointer-events: none;
}

.clicks-icon {
  font-size: 0.9rem;
}

.clicks-count {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
  pointer-events: none;
}

.game-category {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 4px;
}

.player-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.player-count::before {
  content: '👥';
  font-size: 0.875rem;
}

.card-actions {
  display: flex;
  gap: 0.75rem;
  pointer-events: auto;
  min-width: 0;
  flex-wrap: nowrap;
}

.play-btn, .details-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  transition: all 0.2s;
  text-decoration: none;
  position: relative;
  z-index: 1;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.play-btn {
  background-color: var(--color-primary);
  color: white;
}

.play-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.details-btn {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.details-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

@media (prefers-color-scheme: dark) {
  .game-card {
    background: var(--color-surface-dark);
  }
  
  .details-btn {
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-dark);
  }
  
  .details-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}
</style>