<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pin, PinOff } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { useTradingStore } from './stores/trading'
import type { DisplayTimezone } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import AuthView from './views/AuthView.vue'

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

async function signOut() {
  await store.signOut()
}
</script>

<template>
  <div v-if="!store.loaded || !store.authReady" class="loading">正在准备安全同步...</div>
  <main v-else-if="!isSupabaseConfigured" class="auth-shell"><section class="auth-panel"><h1>尚未配置同步服务</h1><p class="auth-copy">请在本机 `.env.local` 或 GitHub Actions Variables 中设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。</p></section></main>
  <AuthView v-else-if="!store.session || store.recoveryMode" />
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">M</span><div><strong>MNQ 纪律助手</strong><small>QQQ 参考 · 已同步</small></div></div>
      <nav>
        <RouterLink to="/">盘中执行</RouterLink>
        <RouterLink to="/strategies">策略管理</RouterLink>
        <RouterLink to="/records">每日记录</RouterLink>
      </nav>
      <div class="sidebar-note">{{ store.isOnline ? '云端同步已启用' : '当前离线，仅可查看缓存' }}</div>
    </aside>
    <main>
      <header class="page-header"><div><p class="eyebrow">MNQ / QQQ</p><h1>{{ title }}</h1></div><div class="page-actions"><RouterLink class="settings-link" to="/strategies#risk">风险设置</RouterLink><label class="timezone-select">时区<select :value="store.data.settings.displayTimezone" @change="updateDisplayTimezone"><option value="Asia/Shanghai">北京时间</option><option value="America/New_York">纽约时间</option></select></label><button class="text-button account-button" :title="store.userEmail" @click="signOut">退出</button><button v-if="isDesktopApp && compactMode" class="pin-toggle" :class="{ pinned }" :title="pinned ? '取消置顶' : '窗口置顶'" :aria-label="pinned ? '取消置顶' : '窗口置顶'" @click="togglePinned"><PinOff v-if="pinned" :size="16" /><Pin v-else :size="16" /></button><button v-if="isDesktopApp" class="compact-toggle" @click="toggleCompact">{{ compactMode ? '退出悬浮' : '悬浮模式' }}</button></div></header>
      <p v-if="store.syncError" class="sync-error">{{ store.syncError }}</p>
      <RouterView />
    </main>
    <div v-if="store.pendingImport" class="modal-backdrop"><section class="modal-panel"><p class="eyebrow">发现本机数据</p><h2>是否导入到新账户？</h2><p>导入后，当前电脑中的策略、交易记录与每日复盘将同步到你的账户。</p><div class="button-row"><button class="primary" @click="store.completeImport(true)">导入本机数据</button><button class="danger-button" @click="store.completeImport(false)">使用空白账户</button></div></section></div>
  </div>
</template>
