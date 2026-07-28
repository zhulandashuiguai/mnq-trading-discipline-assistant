import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AppData, Settings, Strategy, Trade } from '../types'
import { clone, normalizeAppData } from '../data/defaults'
import { getSupabase } from './supabase'

type StrategyRow = { id: string; name: string; entry_rules: string[]; exit_rules: string[]; enabled: boolean; sort_order: number }
type TradeRow = { payload: Trade }
type NoteRow = { trading_date: string; note: string }

function throwIfError(error: { message: string; code?: string } | null) {
  if (!error) return
  if (error.code === '23505') throw new Error('另一台设备已有未平仓交易，请刷新后再试。')
  throw new Error(error.message)
}

export async function loadCloudData(userId: string): Promise<{ data: AppData; empty: boolean }> {
  const client = getSupabase()
  const [settingsResult, strategiesResult, tradesResult, notesResult] = await Promise.all([
    client.from('app_settings').select('value').eq('user_id', userId).maybeSingle(),
    client.from('strategies').select('id,name,entry_rules,exit_rules,enabled,sort_order').eq('user_id', userId).order('sort_order'),
    client.from('trades').select('payload').eq('user_id', userId).order('entered_at', { ascending: false }),
    client.from('daily_notes').select('trading_date,note').eq('user_id', userId)
  ])
  throwIfError(settingsResult.error)
  throwIfError(strategiesResult.error)
  throwIfError(tradesResult.error)
  throwIfError(notesResult.error)

  const strategyRows = (strategiesResult.data || []) as StrategyRow[]
  const tradeRows = (tradesResult.data || []) as TradeRow[]
  const noteRows = (notesResult.data || []) as NoteRow[]
  const empty = !settingsResult.data && strategyRows.length === 0 && tradeRows.length === 0 && noteRows.length === 0
  return {
    empty,
    data: normalizeAppData({
      settings: settingsResult.data?.value as Settings | undefined,
      strategies: strategyRows.map((row) => ({ id: row.id, name: row.name, entryRules: row.entry_rules, exitRules: row.exit_rules, enabled: row.enabled })),
      trades: tradeRows.map((row) => row.payload),
      dailyNotes: Object.fromEntries(noteRows.map((row) => [row.trading_date, row.note]))
    })
  }
}

export async function saveSettings(userId: string, settings: Settings) {
  const { error } = await getSupabase().from('app_settings').upsert({ user_id: userId, value: clone(settings) })
  throwIfError(error)
}

function strategyRow(userId: string, strategy: Strategy, sortOrder: number) {
  return { user_id: userId, id: strategy.id, name: strategy.name, entry_rules: strategy.entryRules, exit_rules: strategy.exitRules, enabled: strategy.enabled, sort_order: sortOrder }
}

export async function saveStrategy(userId: string, strategy: Strategy, sortOrder: number) {
  const { error } = await getSupabase().from('strategies').upsert(strategyRow(userId, strategy, sortOrder), { onConflict: 'user_id,id' })
  throwIfError(error)
}

export async function saveStrategyOrder(userId: string, strategies: Strategy[]) {
  const { error } = await getSupabase().from('strategies').upsert(strategies.map((strategy, index) => strategyRow(userId, strategy, index)), { onConflict: 'user_id,id' })
  throwIfError(error)
}

export async function removeStrategy(userId: string, id: string) {
  const { error } = await getSupabase().from('strategies').delete().eq('user_id', userId).eq('id', id)
  throwIfError(error)
}

export async function createTrade(userId: string, trade: Trade) {
  const { error } = await getSupabase().from('trades').insert({ user_id: userId, id: trade.id, status: trade.status, trading_date: trade.tradingDate, entered_at: trade.enteredAt, payload: clone(trade) })
  throwIfError(error)
}

export async function saveTrade(userId: string, trade: Trade) {
  const { error } = await getSupabase().from('trades').update({ status: trade.status, trading_date: trade.tradingDate, entered_at: trade.enteredAt, payload: clone(trade) }).eq('user_id', userId).eq('id', trade.id)
  throwIfError(error)
}

export async function saveDailyNote(userId: string, tradingDate: string, note: string) {
  const { error } = await getSupabase().from('daily_notes').upsert({ user_id: userId, trading_date: tradingDate, note }, { onConflict: 'user_id,trading_date' })
  throwIfError(error)
}

export async function importCloudData(userId: string, data: AppData) {
  await saveSettings(userId, data.settings)
  await saveStrategyOrder(userId, data.strategies)
  if (data.trades.length) {
    const { error } = await getSupabase().from('trades').upsert(data.trades.map((trade) => ({ user_id: userId, id: trade.id, status: trade.status, trading_date: trade.tradingDate, entered_at: trade.enteredAt, payload: clone(trade) })), { onConflict: 'user_id,id' })
    throwIfError(error)
  }
  if (Object.keys(data.dailyNotes).length) {
    const { error } = await getSupabase().from('daily_notes').upsert(Object.entries(data.dailyNotes).map(([tradingDate, note]) => ({ user_id: userId, trading_date: tradingDate, note })), { onConflict: 'user_id,trading_date' })
    throwIfError(error)
  }
}

export function subscribeToCloudData(userId: string, onChange: () => void): RealtimeChannel {
  const channel = getSupabase().channel(`trading-data-${userId}`)
  for (const table of ['app_settings', 'strategies', 'trades', 'daily_notes']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, onChange)
  }
  return channel.subscribe()
}
