<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()
const mode = ref<'signIn' | 'signUp' | 'forgot' | 'recovery'>('signIn')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')

watch(() => store.recoveryMode, (recovery) => { if (recovery) mode.value = 'recovery' }, { immediate: true })
const title = computed(() => ({ signIn: '登录账户', signUp: '创建账户', forgot: '重设密码', recovery: '设置新密码' }[mode.value]))

function switchMode(next: typeof mode.value) {
  mode.value = next
  error.value = ''
  message.value = ''
  password.value = ''
  confirmPassword.value = ''
}

function checkPassword() {
  if (password.value.length < 8) throw new Error('密码至少需要 8 个字符。')
  if ((mode.value === 'signUp' || mode.value === 'recovery') && password.value !== confirmPassword.value) throw new Error('两次输入的密码不一致。')
}

async function submit() {
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    if (mode.value === 'forgot') {
      await store.sendPasswordReset(email.value.trim())
      message.value = '重设密码邮件已发送，请在邮件中继续操作。'
    } else if (mode.value === 'recovery') {
      checkPassword()
      await store.updatePassword(password.value)
      message.value = '密码已更新。'
    } else if (mode.value === 'signUp') {
      checkPassword()
      const signedIn = await store.signUp(email.value.trim(), password.value)
      message.value = signedIn ? '账户已创建。' : '验证邮件已发送，请完成邮箱验证后登录。'
    } else {
      await store.signIn(email.value.trim(), password.value)
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作失败，请重试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-panel">
      <div class="brand"><span class="brand-mark">M</span><div><strong>MNQ 纪律助手</strong><small>QQQ 参考 · 云端同步</small></div></div>
      <p class="eyebrow">MNQ / QQQ</p>
      <h1>{{ title }}</h1>
      <p class="auth-copy">登录后可在电脑和手机之间同步策略、交易记录与每日复盘。</p>
      <form @submit.prevent="submit">
        <label v-if="mode !== 'recovery'">邮箱<input v-model.trim="email" type="email" autocomplete="email" required /></label>
        <label v-if="mode !== 'forgot'">密码<input v-model="password" type="password" :autocomplete="mode === 'signIn' ? 'current-password' : 'new-password'" minlength="8" required /></label>
        <label v-if="mode === 'signUp' || mode === 'recovery'">确认密码<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="message" class="saved-message">{{ message }}</p>
        <button class="primary auth-submit" :disabled="busy">{{ busy ? '处理中...' : title }}</button>
      </form>
      <div v-if="mode === 'signIn'" class="auth-links"><button class="text-button" @click="switchMode('signUp')">创建账户</button><button class="text-button" @click="switchMode('forgot')">忘记密码</button></div>
      <div v-else-if="mode !== 'recovery'" class="auth-links"><button class="text-button" @click="switchMode('signIn')">返回登录</button></div>
    </section>
  </main>
</template>
