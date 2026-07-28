<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pin, PinOff } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { useTradingStore } from './stores/trading'
import type { DisplayTimezone } from './types'

const store = useTradingStore()
const route = useRoute()
const title = computed(() => route.meta.title || 'MNQ 交易纪律助手')
const isDesktopApp = Boolean(window.windowControls)
const compactMode = ref(false)
const pinned = ref(false)
onMounted(() => store.initialize())

async function toggleCompact() {
  if (window.windowControls) {
    compactMode.value = await window.windowControls.toggleCompact()
    if (!compactMode.value) pinned.value = false
  }
}

async function togglePinned() {
  if (window.windowControls) pinned.value = await window.windowControls.togglePinned()
}

async function updateDisplayTimezone(event: Event) {
  await store.updateDisplayTimezone((event.target as HTMLSelectElement).value as DisplayTimezone)
}
</script>

<template>
  <div v-if="!store.loaded" class="loading">正在读取本地交易数据...</div>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">M</span><div><strong>MNQ 纪律助手</strong><small>QQQ 参考 · 本地记录</small></div></div>
      <nav>
        <RouterLink to="/">盘中执行</RouterLink>
        <RouterLink to="/strategies">策略管理</RouterLink>
        <RouterLink to="/records">每日记录</RouterLink>
      </nav>
      <div class="sidebar-note">所有数据仅保存在当前电脑。</div>
    </aside>
    <main>
      <header class="page-header"><div><p class="eyebrow">MNQ / QQQ</p><h1>{{ title }}</h1></div><div class="page-actions"><RouterLink class="settings-link" to="/strategies#risk">风险设置</RouterLink><label class="timezone-select">时区<select :value="store.data.settings.displayTimezone" @change="updateDisplayTimezone"><option value="Asia/Shanghai">北京时间</option><option value="America/New_York">纽约时间</option></select></label><button v-if="isDesktopApp && compactMode" class="pin-toggle" :class="{ pinned }" :title="pinned ? '取消置顶' : '窗口置顶'" :aria-label="pinned ? '取消置顶' : '窗口置顶'" @click="togglePinned"><PinOff v-if="pinned" :size="16" /><Pin v-else :size="16" /></button><button v-if="isDesktopApp" class="compact-toggle" @click="toggleCompact">{{ compactMode ? '退出悬浮' : '悬浮模式' }}</button></div></header>
      <RouterView />
    </main>
  </div>
</template>
