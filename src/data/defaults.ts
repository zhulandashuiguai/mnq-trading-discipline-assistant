import type { AppData } from '../types'

export const defaultAppData: AppData = {
  strategies: [{
    id: 'mnq-qqq-example',
    name: 'MNQ / QQQ 盘中入场示例',
    entryRules: ['QQQ 日内方向明确', 'QQQ 位于计划关键位置', 'MNQ 出现执行触发', '止损位置已确定', '仓位符合交易计划', '重大数据风险已确认'],
    exitRules: ['触及预设止损', '达到计划目标', 'QQQ 或 MNQ 结构失效', '达到计划时间退出'],
    enabled: true
  }],
  settings: { displayTimezone: 'Asia/Shanghai', maxTrades: 3, targetProfit: 300, maxLoss: 300, maxConsecutiveLosses: 2 },
  trades: [],
  dailyNotes: {}
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function normalizeAppData(value: Partial<AppData>): AppData {
  return {
    strategies: Array.isArray(value.strategies) ? value.strategies : clone(defaultAppData.strategies),
    settings: value.settings ? { ...clone(defaultAppData.settings), ...value.settings } : clone(defaultAppData.settings),
    trades: Array.isArray(value.trades) ? value.trades : [],
    dailyNotes: value.dailyNotes && typeof value.dailyNotes === 'object' ? value.dailyNotes : {}
  }
}

export function hasMeaningfulLocalData(value: AppData) {
  const hasCustomStrategy = value.strategies.length !== 1 || value.strategies[0]?.id !== defaultAppData.strategies[0].id
  return hasCustomStrategy || value.trades.length > 0 || Object.keys(value.dailyNotes).length > 0
}
