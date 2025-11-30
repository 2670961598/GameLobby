<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watch } from 'vue'
import GameCard from './GameCard.vue'
import type { Game } from '../../types/game'

const props = defineProps<{
  games: Game[]
  title: string
  subtitle: string
  isLoading?: boolean
}>()

const windowWidth = ref(window.innerWidth)
const carouselRef = ref<HTMLElement>()
const currentIndex = ref(0)
const isAutoScrolling = ref(true)
const isTransitioning = ref(false)
const isDragging = ref(false)
const startX = ref(0)
const currentX = ref(0)
const startTransform = ref(0)
const direction = ref(1) // 1为正向，-1为反向
let autoScrollTimer: ReturnType<typeof setInterval> | null = null
let autoSnapTimer: ReturnType<typeof setTimeout> | null = null

// 监听窗口大小变化
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

// 根据窗口大小计算显示的游戏数量
const itemsPerView = computed(() => {
  if (windowWidth.value >= 1200) return 4  // 大屏幕显示4个
  if (windowWidth.value >= 900) return 3   // 中等屏幕显示3个
  if (windowWidth.value >= 600) return 2   // 小屏幕显示2个
  return 1                                 // 手机屏幕显示1个
})

// 根据窗口大小计算卡片宽度和间距
const cardWidth = computed(() => {
  if (windowWidth.value >= 1200) return 280
  if (windowWidth.value >= 900) return 280
  if (windowWidth.value >= 600) return 280
  return 280
})

const cardGap = computed(() => {
  return 20
})

// 计算容器宽度，确保显示完整的游戏数量
const containerWidth = computed(() => {
  return itemsPerView.value * cardWidth.value + (itemsPerView.value - 1) * cardGap.value
})

// 计算最大索引（确保最后能完整显示指定数量的游戏）
const maxIndex = computed(() => {
  const totalGames = props.games.length
  if (totalGames <= itemsPerView.value) return 0
  return totalGames - itemsPerView.value
})

// 自动滚动
const startAutoScroll = () => {
  // 先停止现有的定时器，防止重复创建
  stopAutoScroll()
  autoScrollTimer = setInterval(() => {
    if (isAutoScrolling.value && props.games.length > 0 && !isTransitioning.value && !isDragging.value) {
      nextSlide()
    }
  }, 5000)
}

const stopAutoScroll = () => {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }
}

// 自动归位计时器
const startAutoSnap = () => {
  // 先停止现有的定时器，防止重复创建
  stopAutoSnap()
  autoSnapTimer = setTimeout(() => {
    if (!isDragging.value && !isTransitioning.value) {
      snapToNearestCard()
    }
  }, 5000)
}

const stopAutoSnap = () => {
  if (autoSnapTimer) {
    clearTimeout(autoSnapTimer)
    autoSnapTimer = null
  }
}

const nextSlide = () => {
  if (isTransitioning.value || props.games.length === 0) return
  
  isTransitioning.value = true
  
  // 计算下一个索引
  const nextIndex = currentIndex.value + direction.value
  
  // 检查边界并改变方向
  if (nextIndex > maxIndex.value) {
    direction.value = -1  // 到达最后，反向
    currentIndex.value = maxIndex.value - 1
  } else if (nextIndex < 0) {
    direction.value = 1   // 到达开头，正向
    currentIndex.value = 1
  } else {
    currentIndex.value = nextIndex
  }
  
  updateCarouselPosition()
}

const goToSlide = (index: number) => {
  if (isTransitioning.value || index === currentIndex.value || index > maxIndex.value) return
  
  isTransitioning.value = true
  currentIndex.value = index
  updateCarouselPosition()
}

const updateCarouselPosition = () => {
  if (!carouselRef.value) return
  
  const cardSize = cardWidth.value + cardGap.value
  const offset = currentIndex.value * cardSize
  
  // 启用过渡动画
  carouselRef.value.style.transition = 'transform 0.8s ease-in-out'
  carouselRef.value.style.transform = `translateX(-${offset}px)`
  
  // 动画完成后重置过渡状态
  setTimeout(() => {
    isTransitioning.value = false
  }, 800)
}

// 拖拽功能
const handleMouseDown = (e: MouseEvent) => {
  // 检查点击的目标元素
  const target = e.target as HTMLElement
  
  // 如果点击的是按钮、链接或其子元素，不启动拖拽
  if (target.closest('.card-actions') || 
      target.closest('a') || 
      target.closest('button') || 
      target.closest('.play-btn') ||
      target.closest('.details-btn') ||
      target.closest('.play-btn-disabled') ||
      target.closest('.details-btn-disabled')) {
    return
  }
  
  e.preventDefault()
  startDrag(e.clientX)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleTouchStart = (e: TouchEvent) => {
  // 检查点击的目标元素
  const target = e.target as HTMLElement
  
  // 如果点击的是按钮、链接或其子元素，不启动拖拽
  if (target.closest('.card-actions') || 
      target.closest('a') || 
      target.closest('button') || 
      target.closest('.play-btn') ||
      target.closest('.details-btn') ||
      target.closest('.play-btn-disabled') ||
      target.closest('.details-btn-disabled')) {
    return
  }
  
  startDrag(e.touches[0].clientX)
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
}

const startDrag = (clientX: number) => {
  isDragging.value = true
  console.log('开始拖拽，isDragging设为true')
  isAutoScrolling.value = false
  startX.value = clientX
  currentX.value = clientX
  
  if (carouselRef.value) {
    const transform = carouselRef.value.style.transform
    const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/)
    startTransform.value = match ? parseFloat(match[1]) : 0
    carouselRef.value.style.transition = 'none'
  }
  
  stopAutoScroll()
  stopAutoSnap()
}

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    e.preventDefault()
    updateDrag(e.clientX)
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (isDragging.value) {
    e.preventDefault()
    updateDrag(e.touches[0].clientX)
  }
}

const updateDrag = (clientX: number) => {
  currentX.value = clientX
  const deltaX = currentX.value - startX.value
  
  if (carouselRef.value) {
    const newTransform = startTransform.value + deltaX
    
    // 限制拖拽范围，不能超出边界
    const cardSize = cardWidth.value + cardGap.value
    const minTransform = -maxIndex.value * cardSize
    const maxTransform = 0
    
    const clampedTransform = Math.max(minTransform, Math.min(maxTransform, newTransform))
    carouselRef.value.style.transform = `translateX(${clampedTransform}px)`
  }
}

const handleMouseUp = () => {
  endDrag()
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const handleTouchEnd = () => {
  endDrag()
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
}

const endDrag = () => {
  if (!isDragging.value) return
  
  console.log('结束拖拽，isDragging设为false')
  isDragging.value = false
  
  const deltaX = currentX.value - startX.value
  const cardSize = cardWidth.value + cardGap.value
  
  // 计算当前位置对应的游戏索引
  const transform = carouselRef.value?.style.transform
  const match = transform?.match(/translateX\((-?\d+(?:\.\d+)?)px\)/)
  const currentTransform = match ? parseFloat(match[1]) : 0
  
  // 计算最近的游戏索引
  const rawIndex = Math.abs(currentTransform) / cardSize
  let nearestIndex = Math.round(rawIndex)
  
  // 根据拖拽方向和距离调整索引
  if (Math.abs(deltaX) > cardSize / 3) {
    if (deltaX > 0) {
      nearestIndex = Math.floor(rawIndex)
    } else {
      nearestIndex = Math.ceil(rawIndex)
    }
  }
  
  // 限制索引范围
  nearestIndex = Math.max(0, Math.min(maxIndex.value, nearestIndex))
  currentIndex.value = nearestIndex
  
  // 应用平滑过渡到目标位置
  updateCarouselPosition()
  
  // 延迟重启自动滚动，确保过渡动画完成
  setTimeout(() => {
    if (!isDragging.value) { // 再次检查是否还在拖拽
      isAutoScrolling.value = true
      startAutoScroll()
      startAutoSnap()
    }
  }, 800)
}

// 归位到最近的卡片
const snapToNearestCard = () => {
  if (!carouselRef.value || isTransitioning.value || isDragging.value) return
  
  const cardSize = cardWidth.value + cardGap.value
  const transform = carouselRef.value.style.transform
  const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/)
  const currentTransform = match ? parseFloat(match[1]) : 0
  
  // 计算最近的整数位置
  const rawIndex = Math.abs(currentTransform) / cardSize
  const nearestIndex = Math.max(0, Math.min(maxIndex.value, Math.round(rawIndex)))
  const targetTransform = -nearestIndex * cardSize
  
  // 如果当前位置不是整数位置，则归位
  if (Math.abs(currentTransform - targetTransform) > 1) {
    currentIndex.value = nearestIndex
    carouselRef.value.style.transition = 'transform 0.5s ease-out'
    carouselRef.value.style.transform = `translateX(${targetTransform}px)`
  }
}

// 鼠标悬停控制
const handleMouseEnter = () => {
  isAutoScrolling.value = false
  stopAutoScroll()
  stopAutoSnap()
}

const handleMouseLeave = () => {
  // 只有在没有拖拽的情况下才重启自动滚动
  if (!isDragging.value && !isTransitioning.value) {
    isAutoScrolling.value = true
    startAutoScroll()
    startAutoSnap()
  }
}

// 初始化和清理
const init = async () => {
  window.addEventListener('resize', updateWindowWidth)
  await nextTick()
  startAutoScroll()
}

// Watch games changes to restart carousel
watch(() => props.games, async () => {
  if (props.games.length > 0) {
    await nextTick()
    currentIndex.value = 0
    if (carouselRef.value) {
      carouselRef.value.style.transform = 'translateX(0px)'
    }
    startAutoScroll()
  }
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
  stopAutoScroll()
  stopAutoSnap()
})

// Initialize when component mounts
init()
</script>

<template>
  <section class="game-carousel-section">
    <div class="container">
      <h2>{{ title }}</h2>
      <p class="section-subtitle">{{ subtitle }}</p>
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载游戏...</p>
      </div>
      <div v-else-if="games.length === 0" class="empty-state">
        <p>暂无游戏</p>
      </div>
      <div v-else class="carousel-section">
        <div 
          class="carousel-container" 
          :style="{ width: containerWidth + 'px' }"
          @mouseenter="handleMouseEnter" 
          @mouseleave="handleMouseLeave"
          @mousedown="handleMouseDown"
          @touchstart="handleTouchStart"
        >
          <div class="carousel-wrapper">
            <div 
              ref="carouselRef"
              class="game-carousel"
              :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
            >
              <GameCard 
                v-for="(game, _index) in games" 
                :key="game.id"
                :game="game" 
                class="carousel-item"
                :style="{ 
                  width: cardWidth + 'px',
                  marginRight: cardGap + 'px'
                }"
              />
            </div>
          </div>
        </div>
        <div v-if="games.length > itemsPerView" class="carousel-indicators">
          <span 
            v-for="index in maxIndex + 1" 
            :key="index - 1"
            :class="['indicator', { active: (index - 1) === currentIndex }]"
            @click="goToSlide(index - 1)"
          ></span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.game-carousel-section {
  margin-bottom: 4rem;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

h2 {
  margin-bottom: 0.5rem;
  text-align: center;
}

.section-subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.carousel-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 1200px;
}

.carousel-container {
  position: relative;
  overflow: hidden;
  margin: 0 auto;
  user-select: none;
  touch-action: pan-y;
}

.carousel-wrapper {
  overflow: hidden;
  width: 100%;
  display: flex;
  justify-content: flex-start;
}

.game-carousel {
  display: flex;
  will-change: transform;
}

.carousel-item {
  flex-shrink: 0;
  pointer-events: auto;
}

.carousel-indicators {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.3s;
}

.indicator.active {
  background: var(--color-primary);
  transform: scale(1.2);
}

.indicator:hover {
  background: var(--color-primary);
  opacity: 0.7;
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

@media (max-width: 768px) {
  h2 {
    font-size: 1.5rem;
  }
  
  .section-subtitle {
    font-size: 0.875rem;
  }
}

@media (prefers-color-scheme: dark) {
  .loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: var(--color-primary);
  }
  
  .indicator {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style> 