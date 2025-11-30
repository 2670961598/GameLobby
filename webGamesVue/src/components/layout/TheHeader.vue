<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isScrolled = ref(false)
const isMobileMenuOpen = ref(false)

// 节流函数，防止过度频繁的滚动监听
let scrollTimer: number | null = null

const checkScroll = () => {
  // 添加一个小的缓冲区，防止在临界点附近频繁切换
  const scrollY = window.scrollY
  const threshold = 10
  const buffer = 5
  
  if (scrollY > threshold + buffer && !isScrolled.value) {
    isScrolled.value = true
  } else if (scrollY < threshold - buffer && isScrolled.value) {
    isScrolled.value = false
  }
}

const throttledCheckScroll = () => {
  if (scrollTimer) return
  
  scrollTimer = window.requestAnimationFrame(() => {
    checkScroll()
    scrollTimer = null
  })
}

onMounted(() => {
  window.addEventListener('scroll', throttledCheckScroll, { passive: true })
  // 初始检查
  checkScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', throttledCheckScroll)
  if (scrollTimer) {
    window.cancelAnimationFrame(scrollTimer)
  }
})

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}
</script>

<template>
  <header 
    class="site-header" 
    :class="{ 'scrolled': isScrolled }"
  >
    <div class="container header-container">
      <div class="logo">
        <router-link to="/">
          <h1>GameHub</h1>
        </router-link>
      </div>
      
      <button 
        class="mobile-menu-button" 
        @click="toggleMobileMenu"
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      
      <nav 
        class="site-nav" 
        :class="{ 'mobile-open': isMobileMenuOpen }"
      >
        <ul>
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/games">Games</router-link></li>
          <li><router-link to="/upload">Upload Game</router-link></li>
        </ul>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  transition: all 0.2s ease-in-out;
  /* 使用padding而非min-height，但保持一致的计算高度 */
  padding: 1rem 0;
}

.site-header.scrolled {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: rgba(255, 255, 255, 0.95);
  /* 减少padding但保持相对平滑的变化 */
  padding: 0.75rem 0;
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.logo {
  font-size: 1rem;
}

.logo h1 {
  margin: 0;
  font-size: 1.5rem;
  background: linear-gradient(to right, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  color: transparent;
}

.site-nav ul {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 2rem;
}

.site-nav a {
  font-weight: 500;
  padding: 0.5rem;
  transition: color 0.2s;
}

.site-nav a.router-link-active {
  color: var(--color-primary);
  font-weight: 600;
}

.mobile-menu-button {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 30px;
  height: 21px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 10;
}

.mobile-menu-button span {
  display: block;
  height: 3px;
  width: 100%;
  background-color: var(--color-text);
  border-radius: 3px;
  transition: all 0.3s linear;
}

@media (prefers-color-scheme: dark) {
  .site-header {
    background-color: rgba(31, 41, 55, 0.8);
  }
  
  .mobile-menu-button span {
    background-color: var(--color-text-dark);
  }
}

@media (max-width: 768px) {
  .mobile-menu-button {
    display: flex;
  }
  
  .site-nav {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 70%;
    max-width: 300px;
    background-color: var(--color-surface);
    padding: 5rem 2rem 2rem;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
  }
  
  .site-nav.mobile-open {
    transform: translateX(0);
  }
  
  .site-nav ul {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  @media (prefers-color-scheme: dark) {
    .site-nav {
      background-color: var(--color-surface-dark);
    }
  }
}
</style>