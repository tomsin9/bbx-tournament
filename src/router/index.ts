import { createRouter, createWebHistory } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue') },
    { path: '/lobby', name: 'lobby', component: () => import('@/views/LobbyView.vue') },
    { path: '/players', name: 'players', component: () => import('@/views/PlayersView.vue') },
    { path: '/match/:id', name: 'match', component: () => import('@/views/MatchView.vue') },
    { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue') },
  ],
})

router.beforeEach((to) => {
  const store = useTournamentStore()
  if (!store.hydrated) store.hydrate()
  const isQuickMatchRoute =
    to.name === 'match' &&
    (to.params.id === 'quick' || to.query.quick === '1')
  if ((to.name === 'lobby' || (to.name === 'match' && !isQuickMatchRoute)) && !store.hasPlayers) {
    return { name: 'setup' }
  }
  if (to.name === 'match' && typeof to.params.id === 'string' && !isQuickMatchRoute) {
    const m = store.getMatch(to.params.id)
    if (!m) return { name: 'lobby' }
  }
  return true
})

export default router
