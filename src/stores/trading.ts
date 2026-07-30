import { computed, ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import type { AppData, Direction, DisplayTimezone, Settings, Strategy, Trade } from '../types'
import { clone, defaultAppData, hasMeaningfulLocalData, normalizeAppData } from '../data/defaults'
import { createId } from '../utils/id'
import { getPreTradeStatus, nyParts } from '../utils/trading'
import { createTrade, importCloudData, loadCloudData, removeStrategy, saveDailyNote, saveSettings, saveStrategy as saveStrategyRemote, saveStrategyOrder, saveTrade, subscribeToCloudData } from '../lib/cloud'
import { authRedirectUrl, getSupabase, isSupabaseConfigured, supabase } from '../lib/supabase'

const browserStorageKey = 'mnq-trading-checklist-data'

async function loadLocalData(): Promise<AppData> {
  if (window.tradingStorage) return normalizeAppData(await window.tradingStorage.load())
  const saved = window.localStorage.getItem(browserStorageKey)
  if (!saved) return clone(defaultAppData)
  try { return normalizeAppData(JSON.parse(saved)) }
  catch { return clone(defaultAppData) }
}

async function saveLocalData(value: AppData) {
  if (window.tradingStorage) await window.tradingStorage.save(clone(value))
  else window.localStorage.setItem(browserStorageKey, JSON.stringify(value))
}

function online() {
  return typeof navigator === 'undefined' || navigator.onLine
}

export const useTradingStore = defineStore('trading', () => {
  const data = ref<AppData>(clone(defaultAppData))
  const loaded = ref(false)
  const authReady = ref(false)
  const session = ref<Session | null>(null)
  const pendingImport = ref(false)
  const recoveryMode = ref(false)
  const isOnline = ref(online())
  const syncError = ref('')
  const localData = ref<AppData>(clone(defaultAppData))
  let initialized = false
  let refreshTimer: number | undefined
  let realtimeChannel: ReturnType<typeof subscribeToCloudData> | undefined

  const openTrade = computed(() => data.value.trades.find((trade) => trade.status === 'open'))
  const preTradeStatus = computed(() => getPreTradeStatus(data.value.trades, data.value.settings))
  const userId = computed(() => session.value?.user.id || '')
  const userEmail = computed(() => session.value?.user.email || '')

  function clearSubscription() {
    if (realtimeChannel && supabase) void supabase.removeChannel(realtimeChannel)
    realtimeChannel = undefined
  }

  function scheduleRefresh() {
    if (refreshTimer || !session.value || pendingImport.value) return
    refreshTimer = window.setTimeout(() => {
      refreshTimer = undefined
      void refreshFromCloud()
    }, 350)
  }

  async function refreshFromCloud() {
    if (!session.value || !isSupabaseConfigured || !online()) return
    try {
      const remote = await loadCloudData(session.value.user.id)
      if (!remote.empty) {
        data.value = remote.data
        await saveLocalData(data.value)
      }
      syncError.value = ''
    } catch {
      syncError.value = '无法刷新云端数据，请检查网络后重试。'
    }
  }

  async function loadForSession(nextSession: Session | null) {
    clearSubscription()
    session.value = nextSession
    pendingImport.value = false
    syncError.value = ''
    if (!nextSession) {
      data.value = clone(defaultAppData)
      return
    }
    try {
      const remote = await loadCloudData(nextSession.user.id)
      if (remote.empty) {
        if (hasMeaningfulLocalData(localData.value)) {
          data.value = clone(localData.value)
          pendingImport.value = true
        } else {
          data.value = clone(defaultAppData)
          await importCloudData(nextSession.user.id, data.value)
          await saveLocalData(data.value)
        }
      } else {
        data.value = remote.data
        await saveLocalData(data.value)
      }
      realtimeChannel = subscribeToCloudData(nextSession.user.id, scheduleRefresh)
    } catch {
      data.value = clone(localData.value)
      syncError.value = '无法连接云端数据。请检查网络或同步配置后重试。'
    }
  }

  async function initialize() {
    if (initialized) return
    initialized = true
    localData.value = await loadLocalData()
    data.value = clone(localData.value)
    loaded.value = true
    if (!isSupabaseConfigured) {
      authReady.value = true
      return
    }
    try {
      const client = getSupabase()
      const { data: sessionResult } = await client.auth.getSession()
      await loadForSession(sessionResult.session)
      client.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'PASSWORD_RECOVERY') recoveryMode.value = true
        void loadForSession(nextSession)
      })
    } catch {
      syncError.value = '无法连接认证服务，请检查网络或同步配置。'
    }
    window.addEventListener('online', () => { isOnline.value = true; void refreshFromCloud() })
    window.addEventListener('offline', () => { isOnline.value = false })
    authReady.value = true
  }

  function requireUser() {
    if (!session.value) throw new Error('请先登录。')
    if (!online()) throw new Error('当前离线，连接网络后才能保存。')
    return session.value.user.id
  }

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signUp(email: string, password: string) {
    const { data: result, error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } })
    if (error) throw new Error(error.message)
    return Boolean(result.session)
  }

  async function sendPasswordReset(email: string) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    if (error) throw new Error(error.message)
  }

  async function updatePassword(password: string) {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) throw new Error(error.message)
    recoveryMode.value = false
  }

  async function signOut() {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw new Error(error.message)
    localData.value = clone(defaultAppData)
    data.value = clone(defaultAppData)
    await saveLocalData(data.value)
  }

  async function completeImport(importLocal: boolean) {
    const id = requireUser()
    const source = importLocal ? localData.value : clone(defaultAppData)
    await importCloudData(id, source)
    data.value = clone(source)
    pendingImport.value = false
    await saveLocalData(data.value)
  }

  async function updateSettings(settings: Settings) {
    const id = requireUser()
    await saveSettings(id, settings)
    data.value.settings = clone(settings)
    await saveLocalData(data.value)
  }

  async function updateDisplayTimezone(displayTimezone: DisplayTimezone) {
    await updateSettings({ ...data.value.settings, displayTimezone })
  }

  async function saveStrategy(strategy: Strategy) {
    const id = requireUser()
    const index = data.value.strategies.findIndex((item) => item.id === strategy.id)
    const sortOrder = index >= 0 ? index : data.value.strategies.length
    await saveStrategyRemote(id, strategy, sortOrder)
    if (index === -1) data.value.strategies.push(clone(strategy))
    else data.value.strategies[index] = clone(strategy)
    await saveLocalData(data.value)
  }

  async function deleteStrategy(id: string) {
    const user = requireUser()
    await removeStrategy(user, id)
    data.value.strategies = data.value.strategies.filter((item) => item.id !== id)
    await saveLocalData(data.value)
  }

  async function moveStrategy(id: string, direction: -1 | 1) {
    const index = data.value.strategies.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= data.value.strategies.length) return
    const next = clone(data.value.strategies)
    const [strategy] = next.splice(index, 1)
    next.splice(target, 0, strategy)
    await saveStrategyOrder(requireUser(), next)
    data.value.strategies = next
    await saveLocalData(data.value)
  }

  async function startTrade(input: { strategy: Strategy; direction: Direction; checkedEntry: string[]; isException: boolean; unfollowedRules?: string[]; exceptionReason?: string }) {
    const now = new Date()
    const trade: Trade = {
      id: createId(), tradingDate: nyParts(now).date, direction: input.direction, strategyId: input.strategy.id, strategyName: input.strategy.name,
      entryRules: [...input.strategy.entryRules], exitRules: [...input.strategy.exitRules], checkedEntry: [...input.checkedEntry], checkedExit: [],
      enteredAt: now.toISOString(), status: 'open', isException: input.isException, unfollowedRules: input.unfollowedRules, exceptionReason: input.exceptionReason
    }
    await createTrade(requireUser(), trade)
    data.value.trades.unshift(trade)
    await saveLocalData(data.value)
  }

  async function closeTrade(input: { checkedExit: string[]; unfollowedExitRules?: string[]; pnl: number; note?: string }) {
    const existing = openTrade.value
    if (!existing) return
    const trade: Trade = { ...clone(existing), status: 'closed', exitedAt: new Date().toISOString(), checkedExit: [...input.checkedExit], unfollowedExitRules: input.unfollowedExitRules, pnl: input.pnl, note: input.note }
    await saveTrade(requireUser(), trade)
    const index = data.value.trades.findIndex((item) => item.id === trade.id)
    if (index >= 0) data.value.trades[index] = trade
    await saveLocalData(data.value)
  }

  async function setDailyNote(date: string, note: string) {
    await saveDailyNote(requireUser(), date, note)
    data.value.dailyNotes[date] = note
    await saveLocalData(data.value)
  }

  return {
    data, loaded, authReady, session, userEmail, pendingImport, recoveryMode, isOnline, syncError, openTrade, preTradeStatus,
    initialize, refreshFromCloud, signIn, signUp, sendPasswordReset, updatePassword, signOut, completeImport,
    updateSettings, updateDisplayTimezone, saveStrategy, deleteStrategy, moveStrategy, startTrade, closeTrade, setDailyNote
  }
})
