<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(email.value, password.value)
    const redirect = route.query.redirect
    if (redirect) {
      router.push(redirect)
    } else {
      const dest = user.role === 'kitchen' ? '/kitchen' : user.role === 'cashier' ? '/cashier' : '/dashboard'
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
      <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Email") }}</label>
      <div class="relative">
        <EnvelopeIcon class="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="username"
          placeholder="you@restaurant.test"
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
          type="password"
          required
          autocomplete="current-password"
          placeholder="••••••••"
          class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
    </div>

    <p v-if="error" class="text-sm font-medium text-danger-600">{{ $t(error) }}</p>

    <button
      type="submit"
      :disabled="loading"
      class="mt-2 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-50"
    >
      {{ loading ? $t("Signing in…") : $t("Sign In") }}
    </button>
  </form>
</template>
