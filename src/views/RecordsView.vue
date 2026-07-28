<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTradingStore } from '../stores/trading'
import { nyParts } from '../utils/trading'

const store = useTradingStore()
const date = ref(nyParts().date)
const note = ref(store.data.dailyNotes[date.value] || '')
const noteSaveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const records = computed(() => store.data.trades.filter((trade) => trade.tradingDate === date.value).sort((a, b) => b.enteredAt.localeCompare(a.enteredAt)))
const closed = computed(() => records.value.filter((trade) => trade.status === 'closed'))
const totalPnl = computed(() => closed.value.reduce((total, trade) => total + (trade.pnl || 0), 0))
const planTrades = computed(() => records.value.filter((trade) => !trade.isException).length)
function selectDate() { note.value = store.data.dailyNotes[date.value] || ''; noteSaveState.value = 'idle' }
watch(() => store.data.dailyNotes[date.value], (value) => { if (noteSaveState.value !== 'saving') note.value = value || '' })
function displayTime(value?: string) { return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: store.data.settings.displayTimezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—' }
function formatPnl(value?: number) { if (value === undefined) return '未平仓'; return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}` }
async function saveNote() {
  if (noteSaveState.value === 'saving') return
  noteSaveState.value = 'saving'
  try {
    await store.setDailyNote(date.value, note.value)
    noteSaveState.value = 'saved'
  } catch {
    noteSaveState.value = 'error'
  }
}
</script>

<template>
  <section class="records-toolbar"><label>交易日（纽约）<input v-model="date" type="date" @change="selectDate" /></label><div><strong>{{ records.length }} 笔交易</strong><span>{{ planTrades }} 笔计划内</span></div><div><strong :class="totalPnl < 0 ? 'negative' : 'positive'">{{ formatPnl(totalPnl) }}</strong><span>已实现盈亏</span></div></section>
  <section class="panel records-panel">
    <div v-if="!records.length" class="empty-state">该纽约交易日还没有交易记录。</div>
    <div v-else class="records-table"><div class="record header-row"><span>时间 / 方向</span><span>策略</span><span>规则完成</span><span>类型</span><span>盈亏</span><span>备注</span></div><article v-for="trade in records" :key="trade.id" class="record"><div><strong>{{ displayTime(trade.enteredAt) }} · {{ trade.direction === 'long' ? '做多' : '做空' }}</strong><small>{{ trade.status === 'closed' ? `${displayTime(trade.exitedAt)} 平仓` : '未平仓' }}</small></div><span>{{ trade.strategyName }}</span><span>入 {{ trade.checkedEntry.length }}/{{ trade.entryRules.length }} · 出 {{ trade.checkedExit.length }}/{{ trade.exitRules.length }}</span><span :class="trade.isException ? 'exception-tag' : 'plan-tag'">{{ trade.isException ? '例外' : '计划内' }}</span><strong :class="(trade.pnl || 0) < 0 ? 'negative' : 'positive'">{{ formatPnl(trade.pnl) }}</strong><span>{{ trade.note || trade.exceptionReason || '—' }}</span></article></div>
  </section>
  <section class="panel daily-note"><div class="section-heading"><div><p class="eyebrow">收盘复盘</p><h2>{{ date }} 每日备注</h2></div></div><textarea v-model="note" placeholder="记录今天执行得好的部分、偏离计划的地方和明日注意事项" @input="noteSaveState = 'idle'" /><div class="note-actions"><button class="primary" :disabled="noteSaveState === 'saving'" @click="saveNote">{{ noteSaveState === 'saving' ? '保存中...' : '保存复盘备注' }}</button><span v-if="noteSaveState === 'saved'" class="save-success">已保存</span><span v-else-if="noteSaveState === 'error'" class="save-error">保存失败，请重试</span></div></section>
</template>
