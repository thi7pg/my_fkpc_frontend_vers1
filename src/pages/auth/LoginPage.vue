<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(username.value, password.value)
    const redirect = route.query.redirect
    if (redirect) {
      router.push(redirect)
    } else {
      const dest = user.role === 'kitchen' ? '/kitchen' : user.role === 'cashier' ? '/cashier/dashboard' : '/dashboard'
      router.push(dest)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
    <div>
      <label for="username" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Username") }}</label>
      <div class="relative">
        <UserIcon class="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
        <input
          id="username"
          v-model="username"
          type="text"
          required
          autocomplete="username"
          :placeholder="$t('Enter your username')" maxlength="50" pattern="[a-z0-9_.\-]+"
          class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
    </div>

    <div>
      <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Password") }}</label>
      <div class="relative">
        <LockClosedIcon class="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
        <input
          id="password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          required
          autocomplete="current-password"
          :placeholder="$t('Enter your password')"
          class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-12 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="button" :aria-label="showPassword ? $t('Hide password') : $t('Show password')" :aria-pressed="showPassword" class="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600" @click="showPassword = !showPassword"><EyeSlashIcon v-if="showPassword" class="h-4 w-4" /><EyeIcon v-else class="h-4 w-4" /></button>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-sm font-medium text-danger-600">{{ $t(error) }}</p>

    <button
      type="submit"
      :disabled="loading"
      class="mt-2 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-50"
    >
      {{ loading ? $t("Signing in…") : $t("Sign In") }}
    </button>
  </form>
</template>
