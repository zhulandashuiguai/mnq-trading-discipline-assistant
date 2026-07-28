import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export function getSupabase() {
  if (!supabase) throw new Error('尚未配置 Supabase 同步服务。')
  return supabase
}

export function authRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}
