<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTradingStore } from '../stores/trading'
import { getPreTradeStatus, getTimeParts } from '../utils/trading'
import type { Direction, Strategy } from '../types'

const store = useTradingStore()
const selectedId = ref('')
const direction = ref<Direction>('long')
const checkedEntry = ref<string[]>([])
const checkedExit = ref<string[]>([])
const exceptionReason = ref('')
const closePnl = ref<number | null>(null)
const closeNote = ref('')
const error = ref('')
const clock = ref(Date.now())
let timer: number

const strategies = computed(() => store.data.strategies.filter((strategy) => strategy.enabled))
const strategy = computed<Strategy | undefined>(() => strategies.value.find((item) => item.id === selectedId.value) || strategies.value[0])
const status = computed(() => getPreTradeStatus(store.data.trades, store.data.settings, new Date(clock.value)))
const allEntryChecked = computed(() => !!strategy.value && strategy.value.entryRules.every((rule) => checkedEntry.value.includes(rule)))
const needsException = computed(() => status.value.blockedReasons.length > 0 || !allEntryChecked.value)
const displayNow = computed(() => getTimeParts(new Date(clock.value), store.data.settings.displayTimezone))
const displayTimezoneLabel = computed(() => store.data.settings.displayTimezone === 'Asia/Shanghai' ? '北京时间' : '纽约时间')

watch(strategies, (items) => {
  if (!items.some((item) => item.id === selectedId.value)) {
    selectedId.value = items[0]?.id || ''
    resetEntry()
  }
}, { immediate: true })

onMounted(() => { timer = window.setInterval(() => { clock.value = Date.now() }, 30000) })
onBeforeUnmount(() => window.clearInterval(timer))

function resetEntry() { checkedEntry.value = []; exceptionReason.value = ''; error.value = '' }
function toggle(list: string[], rule: string) { const index = list.indexOf(rule); if (index >= 0) list.splice(index, 1); else list.push(rule) }

async function start() {
  if (!strategy.value) { error.value = '请先在策略管理中创建并启用一套策略。'; return }
  if (needsException.value && !exceptionReason.value.trim()) { error.value = '当前交易属于例外交易，请填写原因。'; return }
  error.value = ''
  try {
    await store.startTrade({ strategy: strategy.value, direction: direction.value, checkedEntry: checkedEntry.value, isException: needsException.value, exceptionReason: exceptionReason.value.trim() || undefined })
    checkedEntry.value = []
    exceptionReason.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '入场登记失败，请重试。'
  }
}

async function close() {
  if (closePnl.value === null || Number.isNaN(closePnl.value)) { error.value = '请填写本笔交易的美元盈亏。'; return }
  error.value = ''
  try {
    await store.closeTrade({ checkedExit: checkedExit.value, pnl: closePnl.value, note: closeNote.value.trim() || undefined })
    checkedExit.value = []; closePnl.value = null; closeNote.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '平仓保存失败，请重试。'
  }
}

function formatPnl(value: number) { return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}` }
function formatDisplayTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: store.data.settings.displayTimezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
</script>

<template>
  <section class="summary-grid">
    <article><span>{{ displayTimezoneLabel }}</span><strong>{{ displayNow.date }} {{ displayNow.time }}</strong></article>
    <article><span>今日交易</span><strong>{{ status.tradeCount }} / {{ store.data.settings.maxTrades }} 笔</strong></article>
    <article><span>已实现盈亏</span><strong :class="status.realizedPnl < 0 ? 'negative' : 'positive'">{{ formatPnl(status.realizedPnl) }}</strong></article>
    <article><span>连续亏损</span><strong>{{ status.consecutiveLosses }} / {{ store.data.settings.maxConsecutiveLosses }} 笔</strong></article>
  </section>

  <section v-if="!store.openTrade" class="workflow-grid">
    <div class="panel wide-panel">
      <div class="section-heading"><div><p class="eyebrow">第一步</p><h2>交易前状态</h2></div><span :class="status.blockedReasons.length ? 'status blocked' : 'status ready'">{{ status.blockedReasons.length ? '需要例外登记' : '允许按计划交易' }}</span></div>
      <div class="check-statuses">
        <div :class="status.inSession ? 'pass' : 'fail'">交易时段：{{ status.inSession ? '符合' : '不符合' }}</div>
        <div :class="status.tradeCount < store.data.settings.maxTrades ? 'pass' : 'fail'">次数限制：{{ status.tradeCount }}/{{ store.data.settings.maxTrades }}</div>
        <div :class="status.realizedPnl > -store.data.settings.maxLoss ? 'pass' : 'fail'">日内盈亏：{{ formatPnl(status.realizedPnl) }}</div>
        <div :class="status.consecutiveLosses < store.data.settings.maxConsecutiveLosses ? 'pass' : 'fail'">连续亏损：{{ status.consecutiveLosses }} 笔</div>
      </div>
      <p v-if="status.blockedReasons.length" class="warning">{{ status.blockedReasons.join('；') }}。继续交易将标记为例外。</p>
    </div>

    <div class="panel wide-panel">
      <div class="section-heading"><div><p class="eyebrow">第二步</p><h2>建立 MNQ 交易</h2></div><span class="reference">QQQ 作为观察参考</span></div>
      <div class="form-row">
        <label>策略<select v-model="selectedId" @change="resetEntry"><option v-for="item in strategies" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label>方向<div class="segmented"><button :class="direction === 'long' ? 'selected long' : ''" @click="direction = 'long'">做多</button><button :class="direction === 'short' ? 'selected short' : ''" @click="direction = 'short'">做空</button></div></label>
      </div>
      <div v-if="strategy" class="rule-list">
        <label v-for="rule in strategy.entryRules" :key="rule" class="rule" :class="{ checked: checkedEntry.includes(rule) }"><input type="checkbox" :checked="checkedEntry.includes(rule)" @change="toggle(checkedEntry, rule)" /><span>{{ rule }}</span></label>
      </div>
      <label v-if="needsException" class="exception-field">例外原因<textarea v-model="exceptionReason" placeholder="说明为何在未满足交易前状态或入场规则时继续交易" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="primary" @click="start">{{ needsException ? '登记例外入场' : '确认按计划入场' }}</button>
    </div>
  </section>

  <section v-else class="panel active-trade">
    <div class="section-heading"><div><p class="eyebrow">当前持仓</p><h2>MNQ {{ store.openTrade.direction === 'long' ? '做多' : '做空' }}</h2><p>{{ store.openTrade.strategyName }} · {{ formatDisplayTime(store.openTrade.enteredAt) }} 建仓</p></div><span :class="store.openTrade.isException ? 'status blocked' : 'status ready'">{{ store.openTrade.isException ? '例外交易' : '计划内交易' }}</span></div>
    <div class="rule-list exit-rules"><label v-for="rule in store.openTrade.exitRules" :key="rule" class="rule"><input type="checkbox" :checked="checkedExit.includes(rule)" @change="toggle(checkedExit, rule)" /><span>{{ rule }}</span></label></div>
    <div class="form-row"><label>本笔美元盈亏<input v-model.number="closePnl" type="number" step="0.01" placeholder="例如 -120 或 250" /></label><label>平仓复盘备注<textarea v-model="closeNote" placeholder="记录执行情况或观察" /></label></div>
    <p v-if="error" class="error">{{ error }}</p>
    <button class="primary" @click="close">确认平仓并保存记录</button>
  </section>
</template>
