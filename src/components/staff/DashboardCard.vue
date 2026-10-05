<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: [Object, Function], default: null },
  tone: { type: String, default: 'primary' }, // primary | success | warning | danger | slate
})

const tones = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-500',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}
</script>

<template>
  <div class="card flex items-center gap-4 p-5">
    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" :class="tones[tone]">
      <component :is="icon" v-if="icon" class="h-6 w-6" />
    </div>
    <div>
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ $t(label) }}</p>
      <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ value }}</p>
    </div>
  </div>
</template>
