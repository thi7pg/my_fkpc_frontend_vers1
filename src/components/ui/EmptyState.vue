<script setup>
defineProps({
  title: { type: String, default: 'Nothing here yet' },
  message: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-800">
    <div class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <component :is="icon" v-if="icon" class="h-7 w-7" />
    </div>
    <p class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ $t(title) }}</p>
    <p v-if="message" class="max-w-sm text-sm text-slate-500 dark:text-slate-400">{{ $t(message) }}</p>
    <slot />
  </div>
</template>
