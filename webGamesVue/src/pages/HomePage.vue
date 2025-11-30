<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GameCarousel from '../components/game/GameCarousel.vue'
import { useGameStore } from '../store/game'

const gameStore = useGameStore()
const isLoading = ref(true)

onMounted(async () => {
  try {
    await gameStore.fetchFeaturedGames()
    await gameStore.fetchRecentGames()
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="home-page">
    <section class="hero">
      <div class="container">
        <div class="hero-header">
          <router-link to="/lobby" class="lobby-link">
            <span class="lobby-icon">🎮</span>
            联机大厅
          </router-link>
        </div>
        <div class="hero-content">
          <h1>小游戏集合</h1>
          <p class="hero-subtitle">
            发现并游玩HTML5游戏，与朋友分享，支持离线游玩！
          </p>
          <div class="hero-actions">
            <router-link to="/games" class="btn-primary">浏览游戏</router-link>
            <router-link to="/upload" class="btn-secondary">上传你的游戏</router-link>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Featured Games Carousel -->
    <GameCarousel 
      :games="gameStore.featuredGames"
      title="大家在玩"
      subtitle="最受欢迎的热门游戏"
      :is-loading="isLoading"
    />
    
    <!-- Recent Games Carousel -->
    <GameCarousel 
      :games="gameStore.recentGames"
      title="最近上新"
      subtitle="最新上传的游戏"
      :is-loading="isLoading"
    />
    
    <section class="features">
      <div class="container">
        <h2>平台特色</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🎮</div>
            <h3>随时游玩</h3>
            <p>游戏本地缓存，任何设备都可离线游玩</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>多人游戏</h3>
            <p>与朋友连接，享受实时多人游戏乐趣</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🏆</div>
            <h3>排行榜</h3>
            <p>竞争高分，追踪你的游戏进度</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>跨平台</h3>
            <p>支持桌面、平板、手机的响应式设备</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  /* 移除负margin避免与sticky导航栏冲突 */
  /* margin-top: -2rem; */
}

.hero {
  background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary));
  color: white;
  padding: 4rem 0;
  margin-bottom: 3rem;
  position: relative;
  /* 通过margin-top补偿移除的负边距，保持视觉效果 */
  margin-top: -1rem;
}

.hero-header {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
}

.lobby-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border-radius: 25px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
  will-change: transform;
}

.lobby-link:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.lobby-icon {
  font-size: 1.1rem;
}

.hero-content {
  max-width: 700px;
  text-align: center;
  margin: 0 auto;
}

.hero h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  will-change: transform;
}

.btn-primary {
  background-color: white;
  color: var(--color-primary);
}

.btn-primary:hover {
  background-color: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(5px);
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

section {
  margin-bottom: 4rem;
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

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.features-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  width: 100%;
  max-width: 1200px;
}

.feature-card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  will-change: transform;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin-bottom: 0.75rem;
}

@media (max-width: 768px) {
  .hero {
    padding: 3rem 0;
  }
  
  .hero h1 {
    font-size: 2rem;
  }
  
  .hero-subtitle {
    font-size: 1.125rem;
  }

  .hero-header {
    top: 0.5rem;
    right: 0.5rem;
  }

  .lobby-link {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }
}

@media (prefers-color-scheme: dark) {
  .feature-card {
    background: var(--color-surface-dark);
  }
}
</style>