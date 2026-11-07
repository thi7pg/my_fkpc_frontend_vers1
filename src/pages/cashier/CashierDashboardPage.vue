<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  ArrowPathIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import { t } from '../../languages'
import { cashierService } from '../../services/cashierService'
import { useRestaurantStore } from '../../stores/restaurant'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { createReceiptImage } from '../../utils/receiptImage'
import Modal from '../../components/ui/Modal.vue'
import DateRangeFilter from '../../components/ui/DateRangeFilter.vue'
import { exportList } from '../../utils/listDocuments'
import InvoiceMerge from '../../components/staff/InvoiceMerge.vue'
import { createRequestKey } from '../../utils/requestKey'

const restaurant = useRestaurantStore()
const money = (value) => formatCurrency(value, restaurant.settings.currency || 'USD')
const invoices = ref([])
const status = ref('open')
const dateRange = ref({ from: '', to: '' })
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
function invoiceDate(invoice) {
  return status.value === 'closed'
    ? invoice.payment?.paid_at || invoice.created_at
    : invoice.created_at
}
const savingReceipt = ref(false)
const page = ref(1)
const meta = ref(null)
const loading = ref(false)
const error = ref('')
const selectedInvoice = ref(null)
const modalOpen = ref(false)
const paymentMethod = ref('cash')
const cashReceived = ref('')
const bankVerified = ref(false)
const submittingPayment = ref(false)
const paymentStale = ref(false)
const paymentRequestKey = ref(null)
const pendingPayment = ref(null)
const selectingTables = ref(false)
const selectedIds = ref([])
const mergeOpen = ref(false)
function openMerge() {
  modalOpen.value = false
  mergeOpen.value = true
}
function toggleSelection() {
  selectingTables.value = !selectingTables.value
  selectedIds.value = []
}
function invoicesMerged(invoice) {
  selectedIds.value = []
  selectingTables.value = false
  status.value = 'open'
  page.value = 1
  openCheckout(invoice)
}
function isPaid(invoice) {
  return invoice?.payment?.status === 'paid'
}
const search = ref('')
const visibleInvoices = computed(() => {
  const query = search.value.trim().toLowerCase()
  return invoices.value.filter((invoice) =>
    `${invoice.table} ${invoice.order_number}`.toLowerCase().includes(query),
  )
})
const statusFilters = [
  { value: 'open', label: 'Pending' },
  { value: 'closed', label: 'Paid' },
]
const checkoutStatuses = {
  paid: {
    label: 'Paid',
    action: 'View receipt',
  },
  ready: {
    label: 'Ready for payment',
    action: 'Take payment',
  },
  preparing: {
    label: 'Food in progress',
    action: 'View details',
  },
}

function checkoutStatus(invoice) {
  if (isPaid(invoice)) return checkoutStatuses.paid
  if (invoice.closed_at) return { label: 'Closed', action: 'View details' }
  if (invoice.checkout_requested_at && invoice.can_settle)
    return { label: 'Checkout requested', action: 'Take payment' }
  return invoice.can_settle ? checkoutStatuses.ready : checkoutStatuses.preparing
}

let requestVersion = 0
const amountDueCents = computed(() =>
  Math.round(Number(selectedInvoice.value?.amount_due || 0) * 100),
)
const cashReceivedCents = computed(() => Math.round(Number(cashReceived.value) * 100))
const canPay = computed(
  () =>
    (!loading.value && !submittingPayment.value && !!pendingPayment.value) ||
    (selectedInvoice.value?.can_settle &&
      !isPaid(selectedInvoice.value) &&
      !loading.value &&
      !paymentStale.value &&
      !submittingPayment.value &&
      Number.isFinite(amountDueCents.value) &&
      amountDueCents.value >= 0 &&
      (paymentMethod.value === 'bank'
        ? bankVerified.value
        : /^\d+(\.\d{1,2})?$/.test(cashReceived.value) &&
          Number.isFinite(cashReceivedCents.value) &&
          cashReceivedCents.value >= amountDueCents.value)),
)
async function loadInvoices() {
  const current = ++requestVersion
  loading.value = true
  error.value = ''
  try {
    const response = await cashierService.invoices({
      status: status.value,
      date_from: dateRange.value.from || undefined,
      date_to: dateRange.value.to || undefined,
      timezone: browserTimezone,
      page: page.value,
    })
    if (current !== requestVersion) return
    invoices.value = response.data
    meta.value = response.meta
    if (selectedInvoice.value && modalOpen.value && !submittingPayment.value) {
      const updated = invoices.value.find((invoice) => invoice.id === selectedInvoice.value.id)
      if (updated) {
        if (updated.amount_due !== selectedInvoice.value.amount_due) {
          cashReceived.value = ''
          bankVerified.value = false
        }
        selectedInvoice.value = updated
        paymentStale.value = false
      } else paymentStale.value = true
    }
  } catch (e) {
    if (current === requestVersion) {
      error.value = e.message
      if (modalOpen.value) paymentStale.value = true
    }
  } finally {
    if (current === requestVersion) loading.value = false
  }
}
function selectStatus(value) {
  selectingTables.value = false
  selectedIds.value = []
  status.value = value
  page.value = 1
  loadInvoices()
}
function changePage(next) {
  page.value = next
  loadInvoices()
}
function openCheckout(invoice) {
  if (loading.value || submittingPayment.value) return
  selectedInvoice.value = invoice
  paymentStale.value = true
  cashReceived.value = ''
  bankVerified.value = false
  paymentMethod.value = 'cash'
  paymentRequestKey.value = null
  pendingPayment.value = null
  error.value = ''
  modalOpen.value = true
  loadInvoices()
}
async function settle() {
  if (!canPay.value) return
  submittingPayment.value = true
  paymentRequestKey.value ||= createRequestKey()
  pendingPayment.value ||= {
    id: selectedInvoice.value.id,
    method: paymentMethod.value,
    cents: amountDueCents.value,
    key: paymentRequestKey.value,
  }
  error.value = ''
  try {
    const res = await cashierService.settleInvoice(
      pendingPayment.value.id,
      pendingPayment.value.method,
      pendingPayment.value.cents,
      pendingPayment.value.key,
    )
    selectedInvoice.value = res.data
    pendingPayment.value = null
    status.value = 'closed'
    page.value = 1
    await loadInvoices()
  } catch (e) {
    error.value = e.message
    paymentStale.value = true
    if (e.status && e.status < 500) {
      paymentRequestKey.value = null
      pendingPayment.value = null
    }
    if (e.status === 409) {
      const message = e.message
      await loadInvoices()
      const updatedInvoice = invoices.value.find(
        (invoice) => invoice.id === selectedInvoice.value?.id,
      )
      if (updatedInvoice && !loading.value && !error.value) {
        selectedInvoice.value = updatedInvoice
        paymentStale.value = false
      }
      cashReceived.value = ''
      bankVerified.value = false
      error.value = message
    }
  } finally {
    submittingPayment.value = false
  }
}
function receiptImage(invoice) {
  return createReceiptImage({
    order: invoice,
    restaurant: restaurant.settings,
    t,
    money,
    date: formatDateTime,
  })
}
const cashShortcuts = computed(() => {
  const amount = amountDueCents.value / 100
  return [...new Set([amount, Math.ceil(amount / 5) * 5, Math.ceil(amount / 10) * 10])]
})
async function saveReceipt() {
  if (!isPaid(selectedInvoice.value) || savingReceipt.value) return
  const snapshot = selectedInvoice.value
  savingReceipt.value = true
  try {
    const blob = await receiptImage(snapshot)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${snapshot.order_number}.png`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    error.value = e.message
  } finally {
    savingReceipt.value = false
  }
}

const pageTotal = computed(
  () =>
    visibleInvoices.value.reduce(
      (total, invoice) =>
        total +
        Math.round(Number(isPaid(invoice) ? invoice.paid_amount : invoice.amount_due) * 100),
      0,
    ) / 100,
)
function getTodayDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function selectToday() {
  dateRange.value = { from: getTodayDate(), to: getTodayDate() }
}
watch(dateRange, () => {
  page.value = 1
  loadInvoices()
})

let refreshTimer
onMounted(() => {
  loadInvoices()
  refreshTimer = setInterval(() => {
    if (!loading.value && !submittingPayment.value && !document.hidden) loadInvoices()
  }, 5000)
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  requestVersion++
})

const exporting = ref(false)
const exportError = ref('')
async function downloadList(kind) {
  if (exporting.value || loading.value || submittingPayment.value || pendingPayment.value) return
  exporting.value = true
  exportError.value = ''
  try {
    await exportList({
      type: 'payments',
      kind,
      params: {
        status: status.value,
        date_from: dateRange.value.from || undefined,
        date_to: dateRange.value.to || undefined,
        timezone: browserTimezone,
      },
      search: search.value,
      currency: restaurant.settings.currency || 'USD',
    })
  } catch (error) {
    exportError.value = error.message || 'Unable to export report. Please try again.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="payments-page">
    <header class="payments-heading">
      <h1 class="text-2xl font-bold">{{ $t('Payments') }}</h1>
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="payment-control"
          :disabled="loading || submittingPayment"
          @click="loadInvoices"
        >
          {{ $t('Refresh') }}
        </button>

        <button
          v-for="kind in ['excel', 'pdf']"
          :key="kind"
          type="button"
          class="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
          :disabled="exporting || loading || submittingPayment || !!pendingPayment"
          @click="downloadList(kind)"
        >
          {{ $t(kind === 'excel' ? 'Excel' : 'PDF') }}
        </button>
      </div>
    </header>
    <p v-if="exportError" role="alert" class="text-sm text-danger-600">{{ $t(exportError) }}</p>
    <div class="payments-toolbar">
      <button
        v-if="status === 'open'"
        type="button"
        :disabled="submittingPayment || loading"
        class="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 disabled:opacity-40 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200"
        :aria-pressed="selectingTables"
        @click="toggleSelection"
      >
        {{ $t(selectingTables ? 'Cancel selection' : 'Combine invoices') }}
      </button>
      <div class="payment-tabs" :aria-label="$t('Payments')">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          :aria-pressed="status === filter.value"
          :disabled="submittingPayment || !!pendingPayment"
          @click="selectStatus(filter.value)"
        >
          {{ $t(filter.label) }}
        </button>
      </div>
      <label class="payment-search">
        <span class="sr-only">{{ $t('Search table or invoice') }}</span>
        <input v-model="search" type="search" :placeholder="$t('Search table or invoice')" />
      </label>
    </div>
    <div class="payments-date-filter">
      <DateRangeFilter
        v-model="dateRange"
        id-prefix="payment"
        :disabled="submittingPayment || !!pendingPayment"
      />
      <button
        class="payment-control"
        :aria-pressed="dateRange.from === getTodayDate() && dateRange.to === getTodayDate()"
        :disabled="submittingPayment || !!pendingPayment"
        @click="selectToday"
      >
        {{ $t('Today') }}
      </button>
      <button
        class="payment-control"
        :aria-pressed="!dateRange.from && !dateRange.to"
        :disabled="submittingPayment || !!pendingPayment"
        @click="dateRange = { from: '', to: '' }"
      >
        {{ $t('All days') }}
      </button>
    </div>
    <div class="payments-summary" aria-live="polite">
      <span
        >{{ $t('Payments on this page') }}: <strong>{{ visibleInvoices.length }}</strong></span
      >
      <span
        >{{ $t('Total on this page') }}: <strong>{{ money(pageTotal) }}</strong></span
      >
    </div>
    <div
      v-if="selectingTables"
      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-950"
    >
      <span class="text-sm font-semibold text-primary-700 dark:text-primary-200"
        >{{ $t('Selected tables') }}: {{ selectedIds.length }}</span
      >
      <button
        type="button"
        :disabled="
          selectedIds.length < 2 || selectedIds.length > 30 || loading || submittingPayment
        "
        class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        @click="openMerge()"
      >
        {{ $t('Review invoices') }}
      </button>
    </div>
    <p v-if="error && !modalOpen" role="alert" class="text-sm text-danger-600">{{ $t(error) }}</p>
    <p v-if="loading" role="status" class="text-sm text-slate-500">{{ $t('Loading...') }}</p>
    <div v-if="!loading && !visibleInvoices.length" class="payments-empty">
      {{ $t(status === 'open' ? 'No unpaid bills' : 'No paid bills') }}
    </div>
    <div v-if="visibleInvoices.length" class="surface-card payments-list">
      <div
        v-for="invoice in visibleInvoices"
        :key="invoice.id"
        class="flex items-center border-b border-slate-100 last:border-0 dark:border-slate-800"
      >
        <label v-if="selectingTables" class="flex shrink-0 items-center pl-4"
          ><input
            v-model="selectedIds"
            :value="invoice.id"
            type="checkbox"
            :aria-label="`${$t('Table')} ${invoice.table}`"
            :disabled="!invoice.can_settle || loading || submittingPayment"
            class="h-5 w-5 accent-primary-600"
        /></label>
        <button
          class="payment-row"
          :disabled="loading || submittingPayment"
          @click="openCheckout(invoice)"
        >
          <span class="payment-reference">
            <strong>#{{ invoice.order_number }}</strong>
            <span
              >{{ $t('Table') }} {{ invoice.table }} &middot;
              {{ $t(checkoutStatus(invoice).label) }}</span
            >
          </span>
          <span class="payment-date">
            <span class="text-xs text-slate-400">{{ $t('Date') }}</span>
            <time v-if="invoiceDate(invoice)" :datetime="invoiceDate(invoice)">{{
              formatDateTime(invoiceDate(invoice))
            }}</time>
            <span v-else>—</span>
          </span>
          <span class="payment-actions">
            <strong class="payment-amount">{{
              money(isPaid(invoice) ? invoice.paid_amount : invoice.amount_due)
            }}</strong>
            <span class="payment-row-action">{{ $t(checkoutStatus(invoice).action) }}</span>
          </span>
        </button>
      </div>
    </div>
    <nav
      v-if="meta && meta.last_page > 1"
      class="flex items-center justify-center gap-4"
      :aria-label="$t('Pagination')"
    >
      <button
        class="payment-control"
        :disabled="loading || submittingPayment || page === 1"
        @click="changePage(page - 1)"
      >
        {{ $t('Previous') }}
      </button>
      <span>{{ page }} / {{ meta.last_page }}</span>
      <button
        class="payment-control"
        :disabled="loading || submittingPayment || page === meta.last_page"
        @click="changePage(page + 1)"
      >
        {{ $t('Next') }}
      </button>
    </nav>
    <Modal v-model="modalOpen" :title="isPaid(selectedInvoice) ? 'Receipt' : 'Checkout'" size="lg">
      <div v-if="selectedInvoice" class="max-h-[72dvh] overflow-y-auto pr-1">
        <div
          class="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800"
        >
          <div>
            <h2 class="text-2xl font-bold tracking-tight">
              {{ $t('Table') }} {{ selectedInvoice.table }}
            </h2>
            <p class="mt-1 text-xs text-slate-500">#{{ selectedInvoice.order_number }}</p>
          </div>
          <span
            v-if="isPaid(selectedInvoice)"
            class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
            ><CheckCircleIcon class="h-4 w-4" aria-hidden="true" />{{ $t('Paid') }}</span
          >
          <button
            v-else
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:text-slate-300"
            :disabled="loading || submittingPayment"
            @click="loadInvoices"
          >
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />{{ $t('Refresh checkout') }}
          </button>
        </div>
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-4">
            <h3 class="text-xs font-semibold tracking-wide text-slate-500">
              {{ $t('Order Summary') }}
            </h3>
            <ul class="divide-y divide-slate-100 dark:divide-slate-800">
              <li
                v-for="item in selectedInvoice.items"
                :key="item.id"
                class="flex items-start justify-between gap-3 py-3 text-sm"
              >
                <div class="min-w-0">
                  <span class="text-slate-500">{{ item.quantity }}&times;</span>
                  <span>{{ item.product_name }}</span>
                  <p v-if="item.order_number" class="mt-1 text-[11px] text-slate-400">
                    #{{ item.order_number }}
                  </p>
                </div>
                <span class="shrink-0 font-medium tabular-nums">{{ money(item.subtotal) }}</span>
              </li>
            </ul>
            <div class="space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
              <p class="flex justify-between text-slate-500">
                <span>{{ $t('Subtotal') }}</span
                ><span>{{ money(selectedInvoice.subtotal ?? selectedInvoice.total_amount) }}</span>
              </p>
              <p
                v-if="Number(selectedInvoice.tax_amount) > 0"
                class="flex justify-between text-slate-500"
              >
                <span>{{ $t('Tax') }}</span
                ><span>{{ money(selectedInvoice.tax_amount) }}</span>
              </p>
              <p
                v-if="Number(selectedInvoice.paid_amount) > 0"
                class="flex justify-between text-slate-500"
              >
                <span>{{ $t('Already paid') }}</span
                ><span>{{ money(selectedInvoice.paid_amount) }}</span>
              </p>
              <p class="flex justify-between pt-2 font-semibold">
                <span>{{ $t('Total') }}</span
                ><span>{{ money(selectedInvoice.total_amount) }}</span>
              </p>
            </div>
          </div>
          <div class="space-y-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div class="border-b border-slate-200 pb-4 dark:border-slate-700">
              <p class="text-xs font-medium text-slate-500">
                {{ $t(isPaid(selectedInvoice) ? 'Total paid' : 'Total Due') }}
              </p>
              <p class="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                {{
                  money(
                    isPaid(selectedInvoice)
                      ? selectedInvoice.paid_amount
                      : selectedInvoice.amount_due,
                  )
                }}
              </p>
            </div>
            <p
              v-if="!isPaid(selectedInvoice) && !selectedInvoice.can_settle"
              class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
            >
              {{ $t('Refresh checkout') }}
            </p>
            <template v-if="!isPaid(selectedInvoice) && selectedInvoice.can_settle">
              <label class="block"
                >{{ $t('Payment method')
                }}<select
                  v-model="paymentMethod"
                  :aria-label="$t('Payment method')"
                  :disabled="submittingPayment || !!pendingPayment"
                  class="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="cash">{{ $t('Cash') }}</option>
                  <option value="bank">{{ $t('Bank') }}</option>
                </select></label
              >
              <label v-if="paymentMethod === 'cash'" class="block"
                >{{ $t('Cash received')
                }}<input
                  v-model="cashReceived"
                  inputmode="decimal"
                  :disabled="submittingPayment || !!pendingPayment"
                  class="mt-2 w-full rounded-xl border p-3"
              /></label>
              <div v-if="paymentMethod === 'cash'" class="flex flex-wrap gap-2">
                <button
                  v-for="amount in cashShortcuts"
                  :key="amount"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  :disabled="submittingPayment || !!pendingPayment"
                  @click="cashReceived = amount.toFixed(2)"
                >
                  {{ amount === amountDueCents / 100 ? $t('Exact amount') : money(amount) }}
                </button>
              </div>
              <label v-if="paymentMethod === 'bank'" class="flex gap-3"
                ><input
                  v-model="bankVerified"
                  type="checkbox"
                  :disabled="submittingPayment || !!pendingPayment"
                />{{ $t('I have verified the bank transfer was received.') }}</label
              >
              <p
                v-if="paymentMethod === 'cash' && cashReceived !== ''"
                class="text-right text-sm font-semibold"
              >
                {{ $t('Change') }}:
                {{ money(Math.max(0, cashReceivedCents - amountDueCents) / 100) }}
              </p>
              <button
                class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!canPay"
                @click="settle"
              >
                <BanknotesIcon class="h-4 w-4" aria-hidden="true" />{{
                  $t(
                    submittingPayment
                      ? 'Updating...'
                      : pendingPayment
                        ? 'Try again'
                        : 'Confirm payment',
                  )
                }}
              </button>
            </template>
            <button
              v-if="isPaid(selectedInvoice)"
              :disabled="savingReceipt"
              class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              @click="saveReceipt"
            >
              <DocumentTextIcon class="h-4 w-4" aria-hidden="true" />{{ $t('Save receipt') }}
            </button>
            <p v-if="error" role="alert" class="text-sm text-danger-600">{{ $t(error) }}</p>
          </div>
        </div>
      </div>
    </Modal>
    <InvoiceMerge v-model="mergeOpen" :ids="selectedIds" @merged="invoicesMerged" />
  </section>
</template>

<style scoped>
.payments-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.payments-heading,
.payments-toolbar,
.payments-date-filter,
.payments-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}
.payments-heading,
.payments-summary {
  justify-content: space-between;
}
.payment-control {
  min-height: 42px;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  font-size: 14px;
}
.payment-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 4px;
  background: #f1f5f9;
  border-radius: 12px;
}
.payment-tabs button {
  min-height: 40px;
  padding: 10px 20px;
  border-radius: 9px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}
.payment-tabs button[aria-pressed='true'] {
  background: white;
  color: #ce0233;
  box-shadow: 0 1px 4px #0f172a20;
}
.payment-control[aria-pressed='true'] {
  color: #ce0233;
  border-color: #fda4af;
  background: #fff1f2;
}
.payment-search {
  flex: 1;
  min-width: 0;
}
.payment-search input {
  width: 100%;
  min-height: 46px;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  font-size: 13px;
}
.payments-date-filter {
  flex-wrap: wrap;
}
.payments-summary {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  font-size: 13px;
}
.payments-list {
  overflow: hidden;
  border-radius: 16px;
}
.payment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 66px;
  padding: 16px;
  text-align: left;
}
.payment-row + .payment-row {
  border-top: 1px solid #f1f5f9;
}
.payment-row:hover {
  background: #f8fafc;
}
.payment-reference {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.payment-reference strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.payment-reference > span {
  color: #94a3b8;
  font-size: 12px;
}
.payment-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.payment-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.payment-amount {
  flex-shrink: 0;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.payment-row-action {
  min-width: 102px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #fff1f2;
  color: #ce0233;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}
.payments-empty {
  padding: 48px 20px;
  text-align: center;
  color: #64748b;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
}
button:disabled {
  opacity: 0.5;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid #fb7185;
  outline-offset: 3px;
}
:global(.dark) .payment-control,
:global(.dark) .payment-search input,
:global(.dark) .payments-summary,
:global(.dark) .payments-list {
  background: #0f172a;
  border-color: #334155;
}
:global(.dark) .payment-tabs {
  background: #1e293b;
}
:global(.dark) .payment-tabs button[aria-pressed='true'],
:global(.dark) .payment-row:hover {
  background: #334155;
}
:global(.dark) .payment-row + .payment-row {
  border-color: #1e293b;
}
@media (max-width: 639px) {
  .payments-toolbar {
    flex-wrap: wrap;
  }
  .payment-search {
    flex-basis: 100%;
  }
  .payment-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
  }
  .payment-date {
    grid-column: 1;
    grid-row: 2;
    align-items: flex-start;
  }
  .payment-actions {
    grid-column: 2;
    grid-row: 1 / 3;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  .payments-summary {
    flex-wrap: wrap;
  }
}
</style>
