import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomePage.vue')
  },
  {
    path: '/games',
    name: 'Games',
    component: () => import('../pages/GameLibrary.vue')
  },
  {
    path: '/game/:id',
    name: 'GameDetail',
    component: () => import('../pages/GameDetail.vue'),
    props: true
  },
  {
    path: '/play/:id',
    name: 'GamePlay',
    component: () => import('../pages/GamePlay.vue'),
    props: true
  },
  {
    path: '/upload',
    name: 'GameUpload',
    component: () => import('../pages/GameUpload.vue')
  },
  {
    path: '/lobby',
    name: 'Lobby',
    component: () => import('../pages/LobbyPage.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../pages/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router