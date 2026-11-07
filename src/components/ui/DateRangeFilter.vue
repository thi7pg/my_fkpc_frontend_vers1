<script setup>
const props = defineProps({
  modelValue: { type: Object, required: true },
  idPrefix: { type: String, required: true },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
function update(key, value) {
  const range = { ...props.modelValue, [key]: value }
  if (range.from && range.to && range.from > range.to) {
    range[key === 'from' ? 'to' : 'from'] = value
  }
  emit('update:modelValue', range)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
    <div v-for="key in ['from', 'to']" :key="key" class="flex items-center gap-2">
      <label :for="idPrefix + '-' + key" class="text-sm text-slate-600 dark:text-slate-300">{{
        $t(key === 'from' ? 'From' : 'To')
      }}</label>
      <input
        :id="idPrefix + '-' + key"
        :value="modelValue[key]"
        :disabled="disabled"
        type="date"
        class="min-h-10 w-40 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        @change="update(key, $event.target.value)"
      />
    </div>
  </div>
</template>
