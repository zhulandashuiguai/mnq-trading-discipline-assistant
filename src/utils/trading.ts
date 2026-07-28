import type { DisplayTimezone, PreTradeStatus, Settings, Trade } from '../types'

export const NEW_YORK = 'America/New_York'

export function getTimeParts(now = new Date(), timeZone: DisplayTimezone = NEW_YORK) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {})
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function nyParts(now = new Date()) {
  return getTimeParts(now, NEW_YORK)
}

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function isInSession(time: string, settings: Settings) {
  const value = minutes(time)
  return settings.sessions.some((session) => value >= minutes(session.start) && value <= minutes(session.end))
}

export function getConsecutiveLosses(trades: Trade[]) {
  let count = 0
  for (const trade of [...trades].filter((item) => item.status === 'closed').sort((a, b) => (b.exitedAt || '').localeCompare(a.exitedAt || ''))) {
    if ((trade.pnl || 0) < 0) count += 1
    else break
  }
  return count
}

export function getPreTradeStatus(trades: Trade[], settings: Settings, now = new Date()): PreTradeStatus {
  const { date, time } = nyParts(now)
  const today = trades.filter((trade) => trade.tradingDate === date)
  const closed = today.filter((trade) => trade.status === 'closed')
  const tradeCount = today.length
  const realizedPnl = closed.reduce((total, trade) => total + (trade.pnl || 0), 0)
  const consecutiveLosses = getConsecutiveLosses(today)
  const blockedReasons: string[] = []
  if (!isInSession(time, settings)) blockedReasons.push('当前不在允许交易时段')
  if (tradeCount >= settings.maxTrades) blockedReasons.push(`已达到每日最多 ${settings.maxTrades} 笔交易`)
  if (realizedPnl <= -settings.maxLoss) blockedReasons.push(`已达到每日最大亏损 -$${settings.maxLoss}`)
  if (consecutiveLosses >= settings.maxConsecutiveLosses) blockedReasons.push(`已达到连续亏损 ${settings.maxConsecutiveLosses} 笔限制`)
  return { tradingDate: date, inSession: isInSession(time, settings), tradeCount, realizedPnl, consecutiveLosses, blockedReasons }
}
