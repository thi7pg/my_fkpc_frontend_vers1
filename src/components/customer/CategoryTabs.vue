<script setup>
defineProps({
  categories: { type: Array, required: true },
  modelValue: { type: [Number, String], default: 'all' },
})
defineEmits(['update:modelValue'])
</script>
<template>
  <div
    class="flex items-center gap-2 overflow-x-auto px-1 py-1"
    role="group"
    :aria-label="$t('Menu categories')"
  >
    <button
      v-for="category in [{ id: 'all', name: $t('All') }, ...categories]"
      :key="category.id"
      type="button"
      class="min-h-11 shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      :class="
        modelValue === category.id
          ? 'border-primary-600 bg-primary-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50'
      "
      :aria-pressed="modelValue === category.id"
      @click="$emit('update:modelValue', category.id)"
    >
      {{ category.name }}
    </button>
  </div>
</template>
