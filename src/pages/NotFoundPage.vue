<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center dark:bg-slate-950">
    <p class="text-6xl font-black text-primary-600">404</p>
    <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ $t("Page not found") }}</p>
    <RouterLink to="/" class="mt-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"> {{ $t("Go Home") }} </RouterLink>
  </div>
</template>
