import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    proxy: {
      // API requests to Flask backend (开发模式使用 localhost)
      '/api': {
        target: 'http://localhost:11452',
        changeOrigin: true,
        secure: false
      },
      // Game assets and previews
      '/game': {
        target: 'http://localhost:11452',
        changeOrigin: true,
        secure: false
      },
      // Games directory for preview images
      '/games': {
        target: 'http://localhost:11452',
        changeOrigin: true,
        secure: false
      },
      // Socket.IO for multiplayer features
      '/socket.io': {
        target: 'http://localhost:11452',
        changeOrigin: true,
        ws: true,
        secure: false
      }
    }
  }
})
