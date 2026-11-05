<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import StaffSidebar from '../components/staff/StaffSidebar.vue'
import StaffNavbar from '../components/staff/StaffNavbar.vue'

const mobileSidebarOpen = ref(false)
const route = useRoute()
const mainContent = ref(null)
watch(
  () => route.path,
  () => mainContent.value?.scrollTo({ top: 0, left: 0 }),
  { flush: 'post' },
)
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-surface dark:bg-slate-950">
    <StaffSidebar :mobile-open="mobileSidebarOpen" @close="mobileSidebarOpen = false" />

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <StaffNavbar class="shrink-0" @toggle-sidebar="mobileSidebarOpen = true">
        <template #title>
          <div>
            <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ $t(route.meta.title ?? $t('Dashboard')) }}
            </h1>
            <p
              v-if="['admin-dashboard', 'cashier-overview'].includes(route.name)"
              class="text-xs text-slate-500 dark:text-slate-400"
            >
              {{ $t('Manage your dashboard here') }}
            </p>
          </div>
        </template>
      </StaffNavbar>
      <main ref="mainContent" class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
