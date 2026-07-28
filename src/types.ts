export type Direction = 'long' | 'short'
export type TradeStatus = 'open' | 'closed'
export type DisplayTimezone = 'Asia/Shanghai' | 'America/New_York'

export interface Strategy {
  id: string
  name: string
  entryRules: string[]
  exitRules: string[]
  enabled: boolean
}

export interface Settings {
  displayTimezone: DisplayTimezone
  sessions: { start: string; end: string }[]
  maxTrades: number
  maxLoss: number
  maxConsecutiveLosses: number
}

export interface Trade {
  id: string
  tradingDate: string
  direction: Direction
  strategyId: string
  strategyName: string
  entryRules: string[]
  exitRules: string[]
  checkedEntry: string[]
  checkedExit: string[]
  enteredAt: string
  exitedAt?: string
  status: TradeStatus
  pnl?: number
  isException: boolean
  exceptionReason?: string
  note?: string
}

export interface AppData {
  strategies: Strategy[]
  settings: Settings
  trades: Trade[]
  dailyNotes: Record<string, string>
}

export interface PreTradeStatus {
  tradingDate: string
  inSession: boolean
  tradeCount: number
  realizedPnl: number
  consecutiveLosses: number
  blockedReasons: string[]
}
