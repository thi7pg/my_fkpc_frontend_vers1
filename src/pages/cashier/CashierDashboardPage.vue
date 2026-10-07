<script setup>
import { t } from '../../languages'
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { BanknotesIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { cashierService } from '../../services/cashierService'
import { orderService } from '../../services/orderService'
import { formatCurrency as money, formatDateTime } from '../../utils/format'
import { useRestaurantStore } from '../../stores/restaurant'
import Modal from '../../components/ui/Modal.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { createReceiptImage } from '../../utils/receiptImage'

const toast = useToast()
const restaurant = useRestaurantStore()
const formatCurrency = (amount) => money(amount, restaurant.settings.currency || 'USD')
const search = ref('')
const page = ref(1)
const meta = ref(null)
const cashReceived = ref('')
const cashError = ref('')
const paymentMethod = ref('cash')
const bankVerified = ref(false)
const visiblePayments = computed(() =>
  payments.value.filter((payment) =>
    String(payment.order_number).toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
)
const pageTotal = computed(
  () =>
    payments.value.reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0) /
    100,
)
const dueCents = computed(() => Math.round(Number(activeOrder.value?.total_amount || 0) * 100))
const receivedCents = computed(() => Math.round(Number(cashReceived.value) * 100))
const canPay = computed(
  () =>
    activePayment.value?.status === 'pending' &&
    !!activeOrder.value &&
    (paymentMethod.value === 'bank'
      ? bankVerified.value
      : /^\d+(\.\d{1,2})?$/.test(String(cashReceived.value)) &&
        Number.isFinite(receivedCents.value) &&
        Number.isFinite(dueCents.value) &&
        receivedCents.value >= dueCents.value),
)
const change = computed(() => Math.max(0, receivedCents.value - dueCents.value) / 100)
let loadVersion = 0
let orderVersion = 0
const payments = ref([])
const loading = ref(true)
const statusFilter = ref('pending')
const selectedDay = ref('')
function selectToday() {
  selectedDay.value = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const modalOpen = ref(false)
const activePayment = ref(null)
const activeOrder = ref(null)
const orderLoading = ref(false)
const paying = ref(false)

function selectPaymentMethod(method) {
  paymentMethod.value = method
  bankVerified.value = false
  cashError.value = ''
}

function setCashAmount(amount) {
  cashReceived.value = amount.toFixed(2)
  cashError.value = ''
}

async function load() {
  const version = ++loadVersion
  loading.value = true
  try {
    const res = await cashierService.payments({
      status: statusFilter.value,
      page: page.value,
      date: selectedDay.value || undefined,
    })
    if (version !== loadVersion) return
    payments.value = res.data
    meta.value = res.meta || null
  } catch (e) {
    if (version !== loadVersion) return
    payments.value = []
    meta.value = null
    toast.error(t(e.message))
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
onMounted(load)
watch([statusFilter, selectedDay], () => {
  page.value = 1
  search.value = ''
  load()
})
function changePage(next) {
  page.value = next
  search.value = ''
  load()
}

async function openPayment(payment) {
  if (paying.value) return
  const version = ++orderVersion
  cashReceived.value = ''
  paymentMethod.value = payment.method === 'bank' ? 'bank' : 'cash'
  bankVerified.value = false
  cashError.value = ''
  activePayment.value = payment
  activeOrder.value = null
  modalOpen.value = true
  orderLoading.value = true
  try {
    const res = await orderService.get(payment.order_id)
    if (version === orderVersion) activeOrder.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    if (version === orderVersion) orderLoading.value = false
  }
}

async function printReceipt() {
  if (!activeOrder.value) return
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error(t('Allow pop-ups to print the receipt.'))
    return
  }
  let imageUrl
  try {
    const blob = await createReceiptImage({
      order: { ...activeOrder.value, table: activeOrder.value.table?.table_number },
      restaurant: restaurant.settings,
      t,
      money: formatCurrency,
      date: formatDateTime,
    })
    if (printWindow.closed) return
    imageUrl = URL.createObjectURL(blob)
    printWindow.document.title = t('Receipt')
    const style = printWindow.document.createElement('style')
    style.textContent =
      '@page { size: A6; margin: 0; } body { margin: 0; } img { display: block; width: 105mm; height: 148mm; }'
    printWindow.document.head.appendChild(style)
    const image = printWindow.document.createElement('img')
    image.alt = t('Receipt')
    image.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
    image.src = imageUrl
    printWindow.document.body.appendChild(image)
    printWindow.addEventListener(
      'afterprint',
      () => {
        URL.revokeObjectURL(imageUrl)
        printWindow.close()
      },
      { once: true },
    )
    setTimeout(() => URL.revokeObjectURL(imageUrl), 60000)
  } catch {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    printWindow.close()
    toast.error(t('Could not prepare the receipt. Please try again.'))
  }
}

async function completePayment() {
  if (paying.value) return
  if (!canPay.value) {
    cashError.value = t('Cash received must cover the total due.')
    return
  }
  const orderId = activePayment.value.order_id
  paying.value = true
  try {
    await cashierService.pay(orderId, paymentMethod.value)
    toast.success(t('Payment completed'))
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
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t('Payments') }}</h1>
      <button
        class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        :disabled="loading || paying"
        @click="load"
      >
        {{ $t('Refresh') }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex rounded-xl bg-slate-100 p-1" role="group" :aria-label="$t('Payment status')">
        <button
          v-for="status in ['pending', 'paid']"
          :key="status"
          class="rounded-lg px-5 py-2.5 text-sm font-bold"
          :class="
            statusFilter === status ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
          "
          :aria-pressed="statusFilter === status"
          :disabled="paying"
          @click="statusFilter = status"
        >
          {{ $t(status === 'pending' ? 'Pending' : 'Paid') }}
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        :aria-label="$t('Search orders on this page')"
        :placeholder="$t('Search orders on this page')"
        class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
      />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label for="payment-day" class="text-sm font-semibold">{{ $t('Filter by day') }}</label>
      <input
        id="payment-day"
        v-model="selectedDay"
        type="date"
        :disabled="paying"
        class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
      />
      <button
        class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
        :disabled="paying"
        @click="selectToday"
      >
        {{ $t('Today') }}
      </button>
      <button
        class="rounded-xl border px-4 py-2.5 text-sm font-semibold"
        :class="
          !selectedDay
            ? 'border-primary-600 bg-primary-50 text-primary-600'
            : 'border-slate-200 bg-white'
        "
        :aria-pressed="!selectedDay"
        :disabled="paying"
        @click="selectedDay = ''"
      >
        {{ $t('All days') }}
      </button>
    </div>
    <div
      v-if="!loading"
      class="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm"
    >
      <span
        >{{ $t('Orders on this page') }}: <strong>{{ payments.length }}</strong></span
      >
      <span
        >{{ $t('Total on this page') }}: <strong>{{ formatCurrency(pageTotal) }}</strong></span
      >
    </div>
    <div v-if="loading" class="flex flex-col gap-3">
      <SkeletonLoader variant="line" :count="6" />
    </div>
    <EmptyState
      v-else-if="visiblePayments.length === 0"
      :icon="BanknotesIcon"
      :title="$t('No payments found')"
    />
    <div v-else class="card divide-y divide-slate-100 dark:divide-slate-800">
      <button
        v-for="payment in visiblePayments"
        :key="payment.id"
        class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        @click="openPayment(payment)"
      >
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            #{{ payment.order_number }}
          </p>
          <p class="text-xs text-slate-400">
            {{
              payment.status !== 'paid'
                ? $t('Awaiting payment')
                : payment.received_by
                  ? $t('Received by {name}', { name: payment.received_by })
                  : payment.method === 'acleda'
                    ? $t('Bank')
                    : $t('Receiver not recorded')
            }}
          </p>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-base font-bold text-slate-900 dark:text-slate-100">{{
            formatCurrency(payment.amount)
          }}</span
          ><span
            class="rounded-lg px-3 py-2 text-xs font-bold"
            :class="
              payment.status === 'paid'
                ? 'bg-green-50 text-green-700'
                : 'bg-primary-50 text-primary-600'
            "
            >{{ $t(payment.status === 'paid' ? 'Paid' : 'Take payment') }}</span
          >
        </div>
      </button>
    </div>

    <div v-if="meta && meta.last_page > 1" class="flex items-center justify-center gap-4">
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="loading || page <= 1"
        @click="changePage(page - 1)"
      >
        {{ $t('Previous') }}
      </button>
      <span class="text-sm">{{ page }} / {{ meta.last_page }}</span>
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="loading || page >= meta.last_page"
        @click="changePage(page + 1)"
      >
        {{ $t('Next') }}
      </button>
    </div>
    <Modal v-model="modalOpen" :title="$t('Order Payment')" size="md">
      <div v-if="orderLoading" class="flex justify-center py-10">
        <SkeletonLoader variant="line" :count="4" />
      </div>

      <div
        v-else-if="activeOrder"
        id="receipt"
        class="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-lg font-bold text-slate-900 dark:text-slate-100">
              #{{ activeOrder.order_number }}
            </p>
            <p class="text-xs text-slate-400">
              {{ $t('Table') }} {{ activeOrder.table?.table_number }} &middot;
              {{ formatDateTime(activeOrder.created_at) }}
            </p>
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
            <span>{{ $t('Subtotal') }}</span>
            <span>{{ formatCurrency(activeOrder.subtotal) }}</span>
          </div>
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{{ $t('Tax') }}</span>
            <span>{{ formatCurrency(activeOrder.tax_amount) }}</span>
          </div>
          <div class="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{{ $t('Service Charge') }}</span>
            <span>{{ formatCurrency(activeOrder.service_charge_amount) }}</span>
          </div>
          <div class="flex justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span>{{ $t('Total Due') }}</span>
            <span>{{ formatCurrency(activeOrder.total_amount) }}</span>
          </div>
        </div>

        <div
          v-if="activePayment?.status === 'pending'"
          class="flex gap-2 print:hidden"
          role="group"
          :aria-label="$t('Payment method')"
        >
          <button
            v-for="method in ['cash', 'bank']"
            :key="method"
            class="flex-1 rounded-xl border px-4 py-3 text-sm font-bold"
            :class="
              paymentMethod === method
                ? 'border-primary-600 bg-primary-50 text-primary-600'
                : 'border-slate-200'
            "
            :aria-pressed="paymentMethod === method"
            :disabled="paying"
            @click="selectPaymentMethod(method)"
          >
            {{ $t(method === 'cash' ? 'Cash' : 'Bank') }}
          </button>
        </div>
        <label
          v-if="activePayment?.status === 'pending' && paymentMethod === 'bank'"
          class="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm print:hidden"
        >
          <input v-model="bankVerified" type="checkbox" :disabled="paying" class="mt-1 h-4 w-4" />
          <span>{{ $t('I have verified the bank transfer was received.') }}</span>
        </label>
        <p v-if="activePayment?.status === 'paid'" class="text-sm font-semibold">
          {{ $t('Payment method') }}:
          {{
            $t(
              activePayment.method === 'bank'
                ? 'Bank'
                : activePayment.method === 'cash'
                  ? 'Cash'
                  : activePayment.method,
            )
          }}
        </p>
        <div
          v-if="activePayment?.status === 'pending' && paymentMethod === 'cash'"
          class="rounded-xl bg-slate-50 p-4 print:hidden"
        >
          <label for="cash-received" class="mb-2 block text-sm font-semibold">{{
            $t('Cash received')
          }}</label>
          <input
            id="cash-received"
            v-model="cashReceived"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            :disabled="paying"
            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg"
            @input="cashError = ''"
          />
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="amount in [
                dueCents / 100,
                ...[10, 20, 50, 100].filter((value) => value > dueCents / 100),
              ]"
              :key="amount"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              :disabled="paying"
              @click="setCashAmount(amount)"
            >
              {{ amount === dueCents / 100 ? $t('Exact amount') : formatCurrency(amount) }}
            </button>
          </div>
          <div class="mt-4 flex justify-between text-lg font-bold">
            <span>{{ $t('Change') }}</span
            ><span class="text-success-600">{{ formatCurrency(change) }}</span>
          </div>
          <p v-if="cashError" role="alert" class="mt-2 text-sm text-danger-600">{{ cashError }}</p>
        </div>
        <div class="flex gap-2 print:hidden">
          <button
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="printReceipt"
          >
            <PrinterIcon class="h-4 w-4" /> {{ $t('Print Receipt') }}
          </button>
          <button
            v-if="activePayment?.status !== 'paid'"
            class="flex-1 rounded-xl bg-success-600 py-2.5 text-sm font-semibold text-white hover:bg-success-500 disabled:opacity-50"
            :disabled="paying || !canPay"
            @click="completePayment"
          >
            {{
              paying
                ? $t('Processing…')
                : paymentMethod === 'bank'
                  ? $t('Confirm bank payment')
                  : $t('Receive Cash & Complete')
            }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
