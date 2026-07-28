<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTradingStore } from '../stores/trading'
import type { Settings, Strategy } from '../types'
import { createId } from '../utils/id'

const store = useTradingStore()
const selectedId = ref('')
const saved = ref('')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const makeStrategy = (): Strategy => ({ id: createId(), name: '新策略', entryRules: ['新入场规则'], exitRules: ['新出场规则'], enabled: true })
const draft = ref<Strategy>(makeStrategy())
const settingsDraft = ref<Settings>(clone(store.data.settings))
const selected = computed(() => store.data.strategies.find((item) => item.id === selectedId.value) || store.data.strategies[0])

watch(selected, (value) => { if (value) draft.value = clone(value) }, { immediate: true })
watch(() => store.data.settings, (value) => { settingsDraft.value = clone(value) }, { deep: true })

function select(id: string) { selectedId.value = id; saved.value = '' }
async function createStrategy() { const strategy = makeStrategy(); await store.saveStrategy(strategy); selectedId.value = strategy.id; draft.value = clone(strategy); saved.value = '' }
function addRule(type: 'entryRules' | 'exitRules') { draft.value[type].push('新规则') }
function moveRule(type: 'entryRules' | 'exitRules', index: number, direction: number) { const rules = draft.value[type]; const target = index + direction; if (target < 0 || target >= rules.length) return; [rules[index], rules[target]] = [rules[target], rules[index]] }
function removeRule(type: 'entryRules' | 'exitRules', index: number) { if (draft.value[type].length > 1) draft.value[type].splice(index, 1) }
async function saveStrategy() { draft.value.name = draft.value.name.trim() || '未命名策略'; draft.value.entryRules = draft.value.entryRules.map((rule) => rule.trim()).filter(Boolean); draft.value.exitRules = draft.value.exitRules.map((rule) => rule.trim()).filter(Boolean); await store.saveStrategy(draft.value); selectedId.value = draft.value.id; saved.value = '策略已保存' }
async function moveStrategy(id: string, direction: -1 | 1) { await store.moveStrategy(id, direction); saved.value = '策略顺序已保存' }
async function removeStrategy(id = selected.value?.id) { const strategy = store.data.strategies.find((item) => item.id === id); if (!strategy || store.data.strategies.length <= 1) return; if (!window.confirm(`删除“${strategy.name}”？`)) return; await store.deleteStrategy(strategy.id); if (selectedId.value === strategy.id) selectedId.value = ''; saved.value = '策略已删除' }
async function saveSettings() { settingsDraft.value.maxTrades = Math.max(1, Number(settingsDraft.value.maxTrades)); settingsDraft.value.maxLoss = Math.max(1, Number(settingsDraft.value.maxLoss)); settingsDraft.value.maxConsecutiveLosses = Math.max(1, Number(settingsDraft.value.maxConsecutiveLosses)); await store.updateSettings(settingsDraft.value); saved.value = '风险设置已保存' }
</script>

<template>
  <section class="two-column">
    <aside class="panel strategy-list-panel"><div class="section-heading"><h2>策略列表</h2><button class="icon-button" title="新增策略" aria-label="新增策略" @click="createStrategy">+</button></div><div v-for="(item, index) in store.data.strategies" :key="item.id" class="strategy-item" :class="{ active: item.id === (selected?.id || '') }"><button class="strategy-select" @click="select(item.id)"><span>{{ item.name }}</span><small>{{ item.enabled ? '已启用' : '已停用' }}</small></button><div class="strategy-actions"><button title="上移" aria-label="上移" :disabled="index === 0" @click="moveStrategy(item.id, -1)">↑</button><button title="下移" aria-label="下移" :disabled="index === store.data.strategies.length - 1" @click="moveStrategy(item.id, 1)">↓</button><button class="delete-icon" title="删除策略" aria-label="删除策略" :disabled="store.data.strategies.length <= 1" @click="removeStrategy(item.id)">×</button></div></div></aside>
    <section class="panel strategy-editor">
      <div class="section-heading"><div><p class="eyebrow">策略编辑</p><h2>入场与出场规则</h2></div><label class="toggle"><input v-model="draft.enabled" type="checkbox" />启用</label></div>
      <label>策略名称<input v-model="draft.name" /></label>
      <div class="rule-editor"><div class="subheading"><h3>入场规则</h3><button class="text-button" @click="addRule('entryRules')">+ 添加</button></div><div v-for="(rule, index) in draft.entryRules" :key="`entry-${index}`" class="rule-edit-row"><span>{{ index + 1 }}</span><input v-model="draft.entryRules[index]" /><button title="上移" @click="moveRule('entryRules', index, -1)">↑</button><button title="下移" @click="moveRule('entryRules', index, 1)">↓</button><button title="删除" @click="removeRule('entryRules', index)">×</button></div></div>
      <div class="rule-editor"><div class="subheading"><h3>出场规则</h3><button class="text-button" @click="addRule('exitRules')">+ 添加</button></div><div v-for="(rule, index) in draft.exitRules" :key="`exit-${index}`" class="rule-edit-row"><span>{{ index + 1 }}</span><input v-model="draft.exitRules[index]" /><button title="上移" @click="moveRule('exitRules', index, -1)">↑</button><button title="下移" @click="moveRule('exitRules', index, 1)">↓</button><button title="删除" @click="removeRule('exitRules', index)">×</button></div></div>
      <div class="button-row"><button class="primary" @click="saveStrategy">保存策略</button><button class="danger-button" :disabled="store.data.strategies.length <= 1" @click="removeStrategy()">删除策略</button><span class="saved-message">{{ saved }}</span></div>
    </section>
  </section>

  <section id="risk" class="panel risk-settings">
    <div class="section-heading"><div><p class="eyebrow">America/New_York</p><h2>交易前风险设置</h2></div></div>
    <div class="settings-grid"><label v-for="(session, index) in settingsDraft.sessions" :key="index">交易时段 {{ index + 1 }}<div class="time-inputs"><input v-model="session.start" type="time" /><span>至</span><input v-model="session.end" type="time" /></div></label><label>每日最多交易次数<input v-model.number="settingsDraft.maxTrades" type="number" min="1" /></label><label>每日最大已实现亏损（美元）<input v-model.number="settingsDraft.maxLoss" type="number" min="1" /></label><label>最大连续亏损笔数<input v-model.number="settingsDraft.maxConsecutiveLosses" type="number" min="1" /></label></div>
    <button class="primary" @click="saveSettings">保存风险设置</button>
  </section>
</template>
