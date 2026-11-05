<script setup>
import { computed } from 'vue'
import { ArrowRightIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { nextStatus, STATUS_LABELS } from '../../utils/orderStatus'

const props = defineProps({
  order: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['advance', 'cancel'])
const next = computed(() => nextStatus(props.order.status))
</script>

<template>
  <div v-if="next" class="inline-flex items-center gap-2">
    <button
      type="button"
      :disabled="busy"
      class="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white transition hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-wait disabled:opacity-50"
      @click="emit('advance', order)"
    >
      {{ $t('Mark') }} {{ $t(STATUS_LABELS[next]) }}
      <ArrowRightIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </button>
    <button
      type="button"
      :disabled="busy"
      class="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-danger-200 px-3 text-xs font-semibold text-danger-600 transition hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500 disabled:cursor-wait disabled:opacity-50 dark:border-danger-500/30 dark:text-danger-500 dark:hover:bg-danger-500/10"
      @click="emit('cancel', order)"
    >
      <XMarkIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {{ $t('Cancel') }}
    </button>
  </div>
</template>
