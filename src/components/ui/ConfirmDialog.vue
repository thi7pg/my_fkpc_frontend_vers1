<script setup>
import Modal from './Modal.vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'confirm'])

function cancel() {
  emit('update:modelValue', false)
}
function confirm() {
  emit('confirm')
}
</script>

<template>
  <Modal :model-value="modelValue" size="sm" @update:model-value="(v) => emit('update:modelValue', v)">
    <div class="flex gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        :class="danger ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/10' : 'bg-warning-50 text-warning-600 dark:bg-warning-500/10'"
      >
        <ExclamationTriangleIcon class="h-5 w-5" />
      </div>
      <div>
        <p v-if="title" class="font-medium text-slate-900 dark:text-slate-100">{{ $t(title) }}</p>
        <p v-if="message" class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ $t(message) }}</p>
      </div>
    </div>
    <div class="mt-6 flex justify-end gap-2">
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="cancel"
      >
        {{ $t(cancelLabel) }}
      </button>
      <button
        class="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        :class="danger ? 'bg-danger-600 hover:bg-danger-500' : 'bg-primary-600 hover:bg-primary-500'"
        :disabled="loading"
        @click="confirm"
      >
        {{ loading ? $t("Please wait…") : $t(confirmLabel) }}
      </button>
    </div>
  </Modal>
</template>
