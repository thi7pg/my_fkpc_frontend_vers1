<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Squares2X2Icon,
  TagIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  FireIcon,
  BanknotesIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '../../stores/auth'
import { useRestaurantStore } from '../../stores/restaurant'
import { adminService } from '../../services/adminService'
import DiningTableIcon from '../ui/DiningTableIcon.vue'
import PizzaIcon from '../ui/PizzaIcon.vue'

const props = defineProps({
  mobileOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const auth = useAuthStore()
const restaurant = useRestaurantStore()
const logoFailed = ref(false)
watch(() => restaurant.logo, () => { logoFailed.value = false })
onMounted(async () => {
  if (auth.role !== 'admin') return
  try {
    const res = await adminService.getSettings()
    restaurant.setSettings(res.data)
  } catch {
    // Keep the cached branding if settings are temporarily unavailable.
  }
})

const links = computed(() => {
  if (auth.role === 'kitchen') {
    return [{ name: 'kitchen-dashboard', label: 'Kitchen', icon: FireIcon }]
  }
  if (auth.role === 'cashier') {
    return [
      { name: 'cashier-overview', label: 'Dashboard', icon: Squares2X2Icon },
      { name: 'cashier-tables', label: 'Tables', icon: DiningTableIcon },
      { name: 'cashier-categories', label: 'Categories', icon: TagIcon },
      { name: 'cashier-products', label: 'Products', icon: PizzaIcon },
      { name: 'cashier-dashboard', label: 'Payments', icon: BanknotesIcon },
    ]
  }
  return [
    { name: 'admin-dashboard', label: 'Dashboard', icon: Squares2X2Icon },
    { name: 'admin-tables', label: 'Tables', icon: DiningTableIcon },
    { name: 'admin-categories', label: 'Categories', icon: TagIcon },
    { name: 'admin-products', label: 'Products', icon: PizzaIcon },
    { name: 'admin-orders', label: 'Orders', icon: ClipboardDocumentListIcon },
    { name: 'cashier-dashboard', label: 'Payments', icon: BanknotesIcon },
    { name: 'admin-reports', label: 'Reports', icon: ChartBarIcon },
    { name: 'admin-users', label: 'Staff Users', icon: UsersIcon },
    { name: 'admin-settings', label: 'Settings', icon: Cog6ToothIcon },
  ]
})
</script>

<template>
  <aside class="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
    <div class="flex h-16 items-center gap-2 border-b border-slate-100 px-5 dark:border-slate-800">
      <img v-if="restaurant.logo && !logoFailed" :src="restaurant.logo" :alt="restaurant.name + ' logo'" class="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" @error="logoFailed = true" />
      <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">F</div>
      <span class="min-w-0 truncate font-bold text-slate-900 dark:text-slate-100">{{ restaurant.name }}</span>
    </div>

    <nav class="flex-1 space-y-1 p-3">
      <RouterLink
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        exact-active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/10 dark:!text-primary-400"
      >
        <component :is="link.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
        {{ $t(link.label) }}
      </RouterLink>
    </nav>
  </aside>

  <Teleport to="body">
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" @click="emit('close')" />
    </Transition>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-full"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="mobileOpen"
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-2xl lg:hidden dark:bg-slate-900"
      >
        <div class="flex h-16 items-center gap-2 border-b border-slate-100 px-5 dark:border-slate-800">
          <img v-if="restaurant.logo && !logoFailed" :src="restaurant.logo" :alt="restaurant.name + ' logo'" class="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" @error="logoFailed = true" />
          <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">F</div>
          <span class="min-w-0 truncate font-bold text-slate-900 dark:text-slate-100">{{ restaurant.name }}</span>
        </div>
        <nav class="flex-1 space-y-1 p-3">
          <RouterLink
            v-for="link in links"
            :key="link.name"
            :to="{ name: link.name }"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/10 dark:!text-primary-400"
            @click="emit('close')"
          >
            <component :is="link.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
            {{ $t(link.label) }}
          </RouterLink>
        </nav>
      </aside>
    </Transition>
  </Teleport>
</template>
