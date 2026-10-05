<script setup>
defineProps({
  variant: { type: String, default: 'card' }, 
  count: { type: Number, default: 1 },
})
</script>

<template>
  <template v-for="n in count" :key="n">
    <div v-if="variant === 'card'" class="card animate-pulse overflow-hidden">
      <div class="aspect-square w-full bg-slate-200 dark:bg-slate-800" />
      <div class="space-y-2 p-3">
        <div class="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
    <div v-else-if="variant === 'line'" class="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    <div v-else class="h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
  </template>
</template>
