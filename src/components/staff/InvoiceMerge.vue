<script setup>
import { ref, watch } from 'vue'
import Modal from '../ui/Modal.vue'
import { cashierService } from '../../services/cashierService'
import { useRestaurantStore } from '../../stores/restaurant'
import { formatCurrency } from '../../utils/format'

const props = defineProps({
  modelValue: Boolean,
  ids: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'merged'])
const restaurant = useRestaurantStore()
const money = (amount) => formatCurrency(amount, restaurant.settings.currency || 'USD')
const preview = ref(null)
const busy = ref(false)
const error = ref('')
const stale = ref(true)
let version = 0

async function review() {
  const current = ++version
  busy.value = true
  stale.value = true
  error.value = ''
  try {
    const response = await cashierService.previewMerge(props.ids)
    if (current === version) {
      preview.value = response.data
      stale.value = false
    }
  } catch (e) {
    if (current === version) error.value = e.message
  } finally {
    if (current === version) busy.value = false
  }
}
async function merge() {
  if (busy.value || stale.value || !preview.value) return
  busy.value = true
  error.value = ''
  try {
    const entries = preview.value.invoices.map((invoice) => ({
      id: invoice.id,
      expected_cents: Math.round(Number(invoice.amount_due) * 100),
    }))
    const response = await cashierService.mergeInvoices(entries)
    emit('update:modelValue', false)
    emit('merged', response.data)
  } catch (e) {
    error.value = e.message
    stale.value = true
  } finally {
    busy.value = false
  }
}
watch(
  () => props.modelValue,
  (open) => {
    version++
    preview.value = null
    if (open) review()
  },
)
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Combine invoices"
    size="lg"
    @update:model-value="!busy && emit('update:modelValue', $event)"
  >
    <p v-if="busy" role="status">{{ $t('Loading...') }}</p>
    <p v-if="error" role="alert" class="mb-4 rounded-xl bg-red-50 p-3 text-red-700">
      {{ $t(error) }}
    </p>
    <p class="mb-4 text-sm text-slate-500">
      {{ $t('Combine the selected tables into one invoice. Payment is confirmed separately.') }}
    </p>
    <div class="space-y-3">
      <section
        v-for="invoice in preview?.invoices || []"
        :key="invoice.id"
        class="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
      >
        <div class="flex justify-between gap-3">
          <div>
            <h3 class="font-bold">{{ $t('Table') }} {{ invoice.table }}</h3>
            <p class="text-xs text-slate-500">#{{ invoice.order_number }}</p>
          </div>
          <strong>{{ money(invoice.amount_due ?? invoice.total_amount) }}</strong>
        </div>
        <ul class="mt-3 space-y-2 text-sm">
          <li v-for="item in invoice.items" :key="item.id" class="flex justify-between gap-3">
            <span>{{ item.quantity }} × {{ item.product_name }}</span
            ><span>{{ money(item.subtotal) }}</span>
          </li>
        </ul>
      </section>
      <div
        v-if="preview"
        class="flex justify-between rounded-xl bg-primary-50 p-4 font-bold text-primary-700"
      >
        <span>{{ $t('Total') }}</span
        ><span>{{ money(preview.total_amount) }}</span>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" :disabled="busy" class="rounded-xl border px-4 py-3" @click="review">
          {{ $t('Refresh') }}
        </button>
        <button
          type="button"
          :disabled="busy || stale || !preview"
          class="rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
          @click="merge"
        >
          {{ $t('Combine invoices') }}
        </button>
      </div>
    </template>
  </Modal>
</template>
