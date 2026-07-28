import { describe, expect, it } from 'vitest'
import { clone, defaultAppData, hasMeaningfulLocalData, normalizeAppData } from './defaults'

describe('local data migration detection', () => {
  it('does not prompt to import untouched example data', () => {
    expect(hasMeaningfulLocalData(clone(defaultAppData))).toBe(false)
  })

  it('recognizes saved trades and custom strategies as importable data', () => {
    const withTrade = clone(defaultAppData)
    withTrade.trades.push({ id: 'trade-1', tradingDate: '2026-07-28', direction: 'long', strategyId: 's', strategyName: 's', entryRules: [], exitRules: [], checkedEntry: [], checkedExit: [], enteredAt: '2026-07-28T12:00:00.000Z', status: 'open', isException: false })
    expect(hasMeaningfulLocalData(withTrade)).toBe(true)

    const withStrategy = clone(defaultAppData)
    withStrategy.strategies.push({ ...withStrategy.strategies[0], id: 'custom' })
    expect(hasMeaningfulLocalData(withStrategy)).toBe(true)
  })

  it('fills missing legacy fields with safe defaults', () => {
    const normalized = normalizeAppData({ trades: [] })
    expect(normalized.settings.displayTimezone).toBe('Asia/Shanghai')
    expect(normalized.dailyNotes).toEqual({})
  })
})
