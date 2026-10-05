<script setup>
import { t } from '../../i18n'
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { BanknotesIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { cashierService } from '../../services/cashierService'
import { orderService } from '../../services/orderService'
import { formatCurrency, formatDateTime } from '../../utils/format'
import Modal from '../../components/ui/Modal.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'

const toast = useToast()
const payments = ref([])
const loading = ref(true)
const statusFilter = ref('pending')

const modalOpen = ref(false)
const activePayment = ref(null)
const activeOrder = ref(null)
const orderLoading = ref(false)
const paying = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await cashierService.payments({ status: statusFilter.value })
    payments.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(statusFilter, load)

async function openPayment(payment) {
  activePayment.value = payment
  activeOrder.value = null
  modalOpen.value = true
  orderLoading.value = true
  try {
    const res = await orderService.get(payment.order_id)
    activeOrder.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    orderLoading.value = false
  }
}

function printReceipt() {
  window.print()
}

async function completePayment() {
  paying.value = true
  try {
    await cashierService.pay(activePayment.value.order_id)
    toast.success(t("Payment completed"))
    modalOpen.value = false
    await load()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Payments") }}</h1>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="pending">{{ $t("Pending") }}</option>
        <option value="paid">{{ $t("Paid") }}</option>
      </select>
    </div>

    <div v-if="loading" class="flex flex-col gap-3">
      <SkeletonLoader variant="line" :count="6" />
    </div>
    <EmptyState v-else-if="payments.length === 0" :icon="BanknotesIcon" :title="$t('No payments found')" />
    <div v-else class="card divide-y divide-slate-100 dark:divide-slate-800">
      <button
        v-for="payment in payments"
        :key="payment.id"
        class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        @click="openPayment(payment)"
      >
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">#{{ payment.order_number }}</p>
          <p class="text-xs text-slate-400">{{ payment.status === 'paid' ? `Paid by ${payment.received_by ?? '—'}` : $t("Awaiting payment") }}</p>
        </div>
        <span class="text-base font-bold text-slate-900 dark:text-slate-100">{{ formatCurrency(payment.amount) }}</span>
      </button>
    </div>

    <Modal v-model="modalOpen" :title="$t('Order Payment')" size="md">
      <div v-if="orderLoading" class="flex justify-center py-10">
        <SkeletonLoader variant="line" :count="4" />
      </div>

      <div v-else-if="activeOrder" id="receipt" class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-bold text-slate-900 dark:text-slate-100">#{{ activeOrder.order_number }}</p>
            <p class="text-xs text-slate-400">{{ $t("Table") }} {{ activeOrder.table?.table_number }} &middot; {{ formatDateTime(activeOrder.created_at) }}</p>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ activeOrder.customer?.name }}</p>
        </div>

        <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          <li v-for="item in activeOrder.items" :key="item.id" class="flex justify-between py-2">
            <span>{{ item.quantity }}&times; {{ item.product_name }}</span>
            <span>{{ formatCurrency(item.subtotal) }}</span>
          </li>
        </ul>

        <div class="space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{{ $t("Subtotal") }}</span>
            <span>{{ formatCurrency(activeOrder.subtotal) }}</span>
          </div>
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{{ $t("Tax") }}</span>
            <span>{{ formatCurrency(activeOrder.tax_amount) }}</span>
          </div>
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{{ $t("Service Charge") }}</span>
            <span>{{ formatCurrency(activeOrder.service_charge_amount) }}</span>
          </div>
          <div class="flex justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span>{{ $t("Total Due") }}</span>
            <span>{{ formatCurrency(activeOrder.total_amount) }}</span>
          </div>
        </div>

        <div class="flex gap-2 print:hidden">
          <button
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="printReceipt"
          >
            <PrinterIcon class="h-4 w-4" /> {{ $t("Print Receipt") }} </button>
          <button
            v-if="activePayment?.status !== 'paid'"
            class="flex-1 rounded-xl bg-success-600 py-2.5 text-sm font-semibold text-white hover:bg-success-500 disabled:opacity-50"
            :disabled="paying"
            @click="completePayment"
          >
            {{ paying ? $t("Processing…") : $t("Receive Cash & Complete") }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
