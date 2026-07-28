import { describe, expect, it } from 'vitest'
import { getPreTradeStatus, getTimeParts, isInSession, nyParts } from './trading'
import type { Settings, Trade } from '../types'

const settings: Settings = { displayTimezone: 'Asia/Shanghai', sessions: [{ start: '09:30', end: '11:30' }, { start: '13:30', end: '15:30' }], maxTrades: 3, maxLoss: 300, maxConsecutiveLosses: 2 }
const base = (id: string, pnl: number, exitedAt = `2026-07-24T${14 + Number(id)}:00:00.000Z`): Trade => ({ id, tradingDate: '2026-07-24', direction: 'long', strategyId: 's', strategyName: 's', entryRules: [], exitRules: [], checkedEntry: [], checkedExit: [], enteredAt: exitedAt, exitedAt, status: 'closed', pnl, isException: false })

describe('交易前状态', () => {
  it('按纽约时区生成交易日并判断交易时段', () => {
    expect(nyParts(new Date('2026-07-24T14:00:00Z'))).toEqual({ date: '2026-07-24', time: '10:00' })
    expect(getTimeParts(new Date('2026-07-24T14:00:00Z'), 'Asia/Shanghai')).toEqual({ date: '2026-07-24', time: '22:00' })
    expect(isInSession('10:00', settings)).toBe(true)
    expect(isInSession('12:00', settings)).toBe(false)
  })

  it('达到交易次数、日内亏损和连续亏损限制时阻止入场', () => {
    const trades = [base('1', -100), base('2', -120), base('3', -100)]
    const status = getPreTradeStatus(trades, settings, new Date('2026-07-24T14:00:00Z'))
    expect(status.tradeCount).toBe(3)
    expect(status.realizedPnl).toBe(-320)
    expect(status.consecutiveLosses).toBe(3)
    expect(status.blockedReasons).toHaveLength(3)
  })

  it('午间不在交易时段时要求例外登记', () => {
    const status = getPreTradeStatus([], settings, new Date('2026-07-24T16:00:00Z'))
    expect(status.inSession).toBe(false)
    expect(status.blockedReasons).toContain('当前不在允许交易时段')
  })
})
