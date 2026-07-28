import { createRouter, createWebHashHistory } from 'vue-router'
import TradingView from './views/TradingView.vue'
import StrategiesView from './views/StrategiesView.vue'
import RecordsView from './views/RecordsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: TradingView, meta: { title: '盘中执行' } },
    { path: '/strategies', component: StrategiesView, meta: { title: '策略管理' } },
    { path: '/records', component: RecordsView, meta: { title: '每日记录' } }
  ]
})
