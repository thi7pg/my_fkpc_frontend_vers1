<script setup>
import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import {
  QrCodeIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  PrinterIcon,
} from '@heroicons/vue/24/outline'

import { useToast } from 'vue-toastification'
import { t } from '../../languages'
import { printTableQr } from '../../utils/printTableQr'

const toast = useToast()
const printing = ref(false)
async function printQr() {
  if (!qrImageUrl.value || printing.value) return
  printing.value = true
  try {
    await printTableQr(props.table.table_number, qrImageUrl.value)
  } catch (error) {
    toast.error(error.message)
  } finally {
    printing.value = false
  }
}

const props = defineProps({
  table: { type: Object, required: true },
})
defineEmits(['edit', 'delete', 'regenerate-qr'])

const qrImageUrl = ref('')
watch(
  () => props.table.qr_token,
  async (token, _previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    qrImageUrl.value = ''
    if (!token) return

    const url = new URL(`/order/menu/${encodeURIComponent(token)}`, window.location.origin)
    try {
      const image = await QRCode.toDataURL(url.href, {
        width: 512,
        margin: 4,
        errorCorrectionLevel: 'M',
      })
      if (!cancelled) qrImageUrl.value = image
    } catch {
      if (!cancelled) toast.error(t('Unable to load QR code'))
    }
  },
  { immediate: true },
)

const statusStyles = {
  available: 'bg-success-50 text-success-600 dark:bg-success-500/10',
  occupied: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
  reserved: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10',
  inactive: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
}
</script>

<template>
  <div class="card flex flex-col gap-3 p-4">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ table.table_number }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ $t('Seats') }} {{ table.capacity }}
        </p>
      </div>
      <span
        class="rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
        :class="statusStyles[table.status] ?? statusStyles.available"
      >
        {{ $t(table.status) }}
      </span>
    </div>

    <div class="flex items-center justify-center rounded-xl bg-slate-50 py-4 dark:bg-slate-800">
      <img v-if="qrImageUrl" :src="qrImageUrl" alt="QR code" class="h-32 w-32 object-contain" />
      <QrCodeIcon v-else class="h-16 w-16 text-slate-300 dark:text-slate-600" />
    </div>

    <button
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      :disabled="!qrImageUrl || printing"
      @click="printQr"
    >
      <PrinterIcon class="h-4 w-4" /> {{ $t('Print QR') }}
    </button>
    <div class="flex gap-2">
      <button
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="$emit('edit', table)"
      >
        <PencilIcon class="h-3.5 w-3.5" /> {{ $t('Edit') }}
      </button>
      <button
        class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="$emit('regenerate-qr', table)"
      >
        <ArrowPathIcon class="h-3.5 w-3.5" /> {{ $t('New QR') }}
      </button>
      <button
        class="flex items-center justify-center rounded-lg border border-slate-200 px-2.5 text-danger-600 hover:bg-danger-50 dark:border-slate-700 dark:hover:bg-danger-500/10"
        @click="$emit('delete', table)"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
