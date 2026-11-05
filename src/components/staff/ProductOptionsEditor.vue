<script setup>
const props = defineProps({
  modelValue: { type: Array, required: true },
  label: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

function addOption() {
  emit('update:modelValue', [...props.modelValue, { name: '', price: 0 }])
}

function removeOption(index) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

function updateOption(index, key, value) {
  emit(
    'update:modelValue',
    props.modelValue.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
  )
}
</script>

<template>
  <fieldset
    class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
  >
    <legend class="px-1 text-sm font-semibold">{{ $t(label) }}</legend>
    <div class="mb-3 flex justify-end">
      <button type="button" class="text-sm font-semibold text-primary-600" @click="addOption">
        + {{ $t('Add') }}
      </button>
    </div>
    <div v-for="(option, index) in modelValue" :key="index" class="mt-2 flex items-center gap-2">
      <input
        :value="option.name"
        :aria-label="$t('{label} name {number}', { label: $t(label), number: index + 1 })"
        :placeholder="$t('Name')"
        required
        maxlength="60"
        class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        @input="updateOption(index, 'name', $event.target.value)"
      />
      <input
        :value="option.price"
        :aria-label="$t('{label} price {number}', { label: $t(label), number: index + 1 })"
        type="number"
        min="0"
        max="99999"
        step="0.01"
        required
        class="w-24 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        @input="updateOption(index, 'price', $event.target.value)"
      />
      <button
        type="button"
        :aria-label="`${$t('Remove')} ${option.name || $t(label)}`"
        class="px-2 text-danger-600"
        @click="removeOption(index)"
      >
        ×
      </button>
    </div>
  </fieldset>
</template>
