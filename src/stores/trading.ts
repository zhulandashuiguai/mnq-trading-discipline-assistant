import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AppData, Direction, DisplayTimezone, Settings, Strategy, Trade } from '../types'
import { createId } from '../utils/id'
import { getPreTradeStatus, nyParts } from '../utils/trading'

const emptyData: AppData = {
  strategies: [{
    id: 'mnq-qqq-example',
    name: 'MNQ / QQQ 盘中入场示例',
    entryRules: ['确认当前处于计划交易时段', 'QQQ 日内方向明确', 'QQQ 位于计划关键位置', 'MNQ 出现执行触发', '止损位置已确定', '仓位符合交易计划', '重大数据风险已确认'],
    exitRules: ['触及预设止损', '达到计划目标', 'QQQ 或 MNQ 结构失效', '达到计划时间退出'],
    enabled: true
  }],
  settings: { displayTimezone: 'Asia/Shanghai', sessions: [{ start: '09:30', end: '11:30' }, { start: '13:30', end: '15:30' }], maxTrades: 3, maxLoss: 300, maxConsecutiveLosses: 2 },
  trades: [],
  dailyNotes: {}
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const browserStorageKey = 'mnq-trading-checklist-data'

function normalizeBrowserData(value: Partial<AppData>): AppData {
  return {
    strategies: Array.isArray(value.strategies) ? value.strategies : clone(emptyData.strategies),
    settings: value.settings ? { ...clone(emptyData.settings), ...value.settings } : clone(emptyData.settings),
    trades: Array.isArray(value.trades) ? value.trades : [],
    dailyNotes: value.dailyNotes && typeof value.dailyNotes === 'object' ? value.dailyNotes : {}
  }
}

export const useTradingStore = defineStore('trading', () => {
  const data = ref<AppData>(clone(emptyData))
  const loaded = ref(false)
  const openTrade = computed(() => data.value.trades.find((trade) => trade.status === 'open'))
  const preTradeStatus = computed(() => getPreTradeStatus(data.value.trades, data.value.settings))

  async function initialize() {
    if (loaded.value) return
    if (window.tradingStorage) data.value = await window.tradingStorage.load()
    else {
      const saved = window.localStorage.getItem(browserStorageKey)
      if (saved) {
        try { data.value = normalizeBrowserData(JSON.parse(saved)) }
        catch { data.value = clone(emptyData) }
      }
    }
    loaded.value = true
  }

  async function persist() {
    if (window.tradingStorage) await window.tradingStorage.save(clone(data.value))
    else window.localStorage.setItem(browserStorageKey, JSON.stringify(data.value))
  }

  async function updateSettings(settings: Settings) {
    data.value.settings = clone(settings)
    await persist()
  }

  async function updateDisplayTimezone(displayTimezone: DisplayTimezone) {
    data.value.settings.displayTimezone = displayTimezone
    await persist()
  }

  async function saveStrategy(strategy: Strategy) {
    const index = data.value.strategies.findIndex((item) => item.id === strategy.id)
    if (index === -1) data.value.strategies.push(clone(strategy))
    else data.value.strategies[index] = clone(strategy)
    await persist()
  }

  async function deleteStrategy(id: string) {
    data.value.strategies = data.value.strategies.filter((item) => item.id !== id)
    await persist()
  }

  async function moveStrategy(id: string, direction: -1 | 1) {
    const index = data.value.strategies.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= data.value.strategies.length) return
    const [strategy] = data.value.strategies.splice(index, 1)
    data.value.strategies.splice(target, 0, strategy)
    await persist()
  }

  async function startTrade(input: { strategy: Strategy; direction: Direction; checkedEntry: string[]; isException: boolean; exceptionReason?: string }) {
    const now = new Date()
    const trade: Trade = {
      id: createId(),
      tradingDate: nyParts(now).date,
      direction: input.direction,
      strategyId: input.strategy.id,
      strategyName: input.strategy.name,
      entryRules: [...input.strategy.entryRules],
      exitRules: [...input.strategy.exitRules],
      checkedEntry: [...input.checkedEntry],
      checkedExit: [],
      enteredAt: now.toISOString(),
      status: 'open',
      isException: input.isException,
      exceptionReason: input.exceptionReason
    }
    data.value.trades.unshift(trade)
    await persist()
  }

  async function closeTrade(input: { checkedExit: string[]; pnl: number; note?: string }) {
    const trade = openTrade.value
    if (!trade) return
    trade.status = 'closed'
    trade.exitedAt = new Date().toISOString()
    trade.checkedExit = [...input.checkedExit]
    trade.pnl = input.pnl
    trade.note = input.note
    await persist()
  }

  async function setDailyNote(date: string, note: string) {
    data.value.dailyNotes[date] = note
    await persist()
  }

  return { data, loaded, openTrade, preTradeStatus, initialize, updateSettings, updateDisplayTimezone, saveStrategy, deleteStrategy, moveStrategy, startTrade, closeTrade, setDailyNote }
})
