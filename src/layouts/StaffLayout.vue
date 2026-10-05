<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import StaffSidebar from '../components/staff/StaffSidebar.vue'
import StaffNavbar from '../components/staff/StaffNavbar.vue'

const mobileSidebarOpen = ref(false)
const route = useRoute()
</script>

<template>
  <div class="flex min-h-screen bg-surface dark:bg-slate-950">
    <StaffSidebar :mobile-open="mobileSidebarOpen" @close="mobileSidebarOpen = false" />

    <div class="flex min-h-screen flex-1 flex-col">
      <StaffNavbar @toggle-sidebar="mobileSidebarOpen = true">
        <template #title>
          <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ $t(route.meta.title ?? $t("Dashboard")) }}</h1>
        </template>
      </StaffNavbar>
      <main class="flex-1 p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
