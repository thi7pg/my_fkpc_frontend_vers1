<script setup>
import LanguageSelector from '../ui/LanguageSelector.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRightOnRectangleIcon, ChevronDownIcon, Bars3Icon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits(['toggle-sidebar'])
const auth = useAuthStore()
const router = useRouter()
const open = ref(false)

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-center gap-3">
      <button
        class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
        @click="emit('toggle-sidebar')"
      >
        <Bars3Icon class="h-5 w-5" />
      </button>
      <slot name="title">
        <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ $t("Dashboard") }}</h1>
      </slot>
    </div>

    <div class="ml-auto flex items-center gap-3"><LanguageSelector />
    <div class="relative">
      <button
        class="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        @click="open = !open"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
          {{ auth.user?.name?.charAt(0)?.toUpperCase() ?? '?' }}
        </span>
        <span class="hidden text-sm font-medium text-slate-700 sm:block dark:text-slate-200">{{ auth.user?.name }}</span>
        <ChevronDownIcon class="h-4 w-4 text-slate-400" />
      </button>

      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 scale-95" leave-active-class="transition duration-100" leave-to-class="opacity-0 scale-95">
        <div
          v-if="open"
          class="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          @click="open = false"
        >
          <div class="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p class="text-sm font-medium text-slate-900 dark:text-slate-100">{{ auth.user?.name }}</p>
            <p class="text-xs capitalize text-slate-400">{{ $t(auth.user?.role) }}</p>
          </div>
          <button
            class="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
            @click="handleLogout"
          >
            <ArrowRightOnRectangleIcon class="h-4 w-4" /> {{ $t("Log out") }} </button>
        </div>
      </Transition>
    </div>
    </div>
  </header>
</template>
