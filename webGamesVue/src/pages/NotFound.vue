<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.go(-1)
}

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="not-found-page">
    <div class="container">
      <div class="not-found-content">
        <div class="error-code">404</div>
        <h1>Page Not Found</h1>
        <p class="error-message">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <div class="error-actions">
          <button @click="goBack" class="btn-secondary">Go Back</button>
          <button @click="goHome" class="btn-primary">Go Home</button>
          <router-link to="/games" class="btn-primary">Browse Games</router-link>
        </div>
        <div class="error-illustration">
          <div class="game-icon">🎮</div>
          <div class="floating-elements">
            <div class="element" style="--delay: 0s">✨</div>
            <div class="element" style="--delay: 1s">🎯</div>
            <div class="element" style="--delay: 2s">🏆</div>
            <div class="element" style="--delay: 1.5s">⭐</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 0;
}

.not-found-content {
  max-width: 600px;
  margin: 0 auto;
}

.error-code {
  font-size: 8rem;
  font-weight: 900;
  color: var(--color-primary);
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: var(--color-text);
}

.error-message {
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  margin-bottom: 2.5rem;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

.btn-primary, .btn-secondary {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-2px);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 2px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-background);
  transform: translateY(-2px);
}

.error-illustration {
  position: relative;
  margin-top: 2rem;
}

.game-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  filter: grayscale(50%);
  opacity: 0.7;
}

.floating-elements {
  position: relative;
  height: 100px;
}

.element {
  position: absolute;
  font-size: 1.5rem;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
  animation-delay: var(--delay);
}

.element:nth-child(1) {
  left: 10%;
  top: 20%;
}

.element:nth-child(2) {
  right: 15%;
  top: 10%;
}

.element:nth-child(3) {
  left: 20%;
  bottom: 20%;
}

.element:nth-child(4) {
  right: 25%;
  bottom: 30%;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-code {
    font-size: 6rem;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .error-message {
    font-size: 1.1rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .btn-primary, .btn-secondary {
    width: 200px;
  }
}

@media (max-width: 480px) {
  .error-code {
    font-size: 4rem;
  }
  
  .not-found-page {
    padding: 1rem;
  }
}
</style> 