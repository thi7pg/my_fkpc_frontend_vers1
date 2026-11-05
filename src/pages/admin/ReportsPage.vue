<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import {
  BanknotesIcon,
  ShoppingBagIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ChartBarIcon,
  TableCellsIcon,
  ArrowPathIcon,
} from '@heroicons/vue/24/outline'
import { adminService } from '../../services/adminService'
import { useRestaurantStore } from '../../stores/restaurant'
import { formatCurrency } from '../../utils/format'
import { exportReportPdf, exportReportExcel } from '../../utils/reportDocuments'
import ReportTrend from '../../components/staff/ReportTrend.vue'

const toast = useToast()
const restaurant = useRestaurantStore()
const currency = computed(() => restaurant.settings.currency || 'USD')
const money = (value) => formatCurrency(value, currency.value)

const PRESETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'This Year', 'Custom']
const PAGE_SIZE = 15
const REPORT_TABS = ['overview', 'details']
const DETAIL_TABS = ['daily', 'products']
const EXPORT_ACTIONS = [
  { kind: 'excel', label: 'Excel', icon: DocumentArrowDownIcon },
  { kind: 'pdf', label: 'PDF', icon: DocumentTextIcon },
]
const DETAIL_COLUMNS = {
  daily: ['Date', 'Revenue', 'Paid invoices', 'Orders placed'],
  products: ['Product', 'Category', 'Quantity sold', 'Sales amount'],
}
const METRIC_NAMES = {
  'Total Revenue': 'Revenue',
  'Total Invoices': 'Invoices',
  'Total Orders': 'Orders',
  Completed: 'Served',
  'Cancelled orders': 'Cancelled',
}

const activePreset = ref('This Month')
const loadError = ref('')
const loadedRange = ref(null)
const exporting = ref(false)
const groupBy = ref('day')
const from = ref('')
const to = ref('')
const loading = ref(false)
const report = ref(null)
const activeTab = ref('overview')
const detailTab = ref('daily')
const productSearch = ref('')
const detailPage = ref(1)

let requestVersion = 0

function toDateInput(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function applyPreset(preset) {
  activePreset.value = preset
  groupBy.value = preset === 'This Year' ? 'month' : 'day'
  if (preset === 'Custom') return
  const end = new Date()
  const start = new Date(end)
  if (preset === 'Yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  } else if (preset === 'This Week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  } else if (preset === 'This Month') start.setDate(1)
  else if (preset === 'This Year') start.setMonth(0, 1)
  to.value = toDateInput(end)
  from.value = toDateInput(start)
}

async function fetchReport() {
  const version = ++requestVersion
  loadError.value = ''
  if (from.value > to.value) {
    loading.value = false
    loadError.value = 'Start date must be before end date.'
    return
  }
  const range = { from: from.value, to: to.value, groupBy: groupBy.value }
  loading.value = true
  try {
    const res = await adminService.reports.revenue({
      from: from.value,
      to: to.value,
      group_by: groupBy.value,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (version === requestVersion) {
      report.value = res.data
      loadedRange.value = range
    }
  } catch (e) {
    if (version === requestVersion) loadError.value = e.message
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

onMounted(() => {
  applyPreset('This Month')
})
onUnmounted(() => {
  requestVersion++
})

watch([from, to, groupBy], () => {
  if (from.value && to.value) fetchReport()
})

const series = computed(() => report.value?.series ?? [])
const reportGrouping = computed(
  () => report.value?.group_by || loadedRange.value?.groupBy || groupBy.value,
)
const daily = computed(() => report.value?.daily_summary || [])
const products = computed(() => report.value?.product_sales || [])
const categories = computed(() => report.value?.category_sales || [])
const bestSellers = computed(() => report.value?.top_products || [])
const filteredProducts = computed(() => {
  const query = productSearch.value.trim().toLocaleLowerCase()
  return products.value.filter((product) =>
    `${product.name} ${product.category}`.toLocaleLowerCase().includes(query),
  )
})
const details = computed(() => (detailTab.value === 'daily' ? daily.value : filteredProducts.value))
const detailPages = computed(() => Math.max(1, Math.ceil(details.value.length / PAGE_SIZE)))
const visibleDetails = computed(() =>
  details.value.slice((detailPage.value - 1) * PAGE_SIZE, detailPage.value * PAGE_SIZE),
)
watch([report, detailTab, productSearch], () => {
  detailPage.value = 1
})
function viewProducts() {
  activeTab.value = 'details'
  detailTab.value = 'products'
}
function navigateTabs(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  activeTab.value =
    event.key === 'Home'
      ? 'overview'
      : event.key === 'End'
        ? 'details'
        : activeTab.value === 'overview'
          ? 'details'
          : 'overview'
  document.getElementById(`report-${activeTab.value}-tab`)?.focus()
}
function barWidth(value, rows, field) {
  return (
    Math.max(0, (Number(value) / Math.max(1, ...rows.map((row) => Number(row[field])))) * 100) + '%'
  )
}
const metrics = computed(() => [
  { label: 'Total Revenue', value: money(report.value?.total_revenue || 0), icon: BanknotesIcon },
  {
    label: 'Total Invoices',
    value: report.value?.total_invoices ?? '—',
    icon: DocumentDuplicateIcon,
  },
  {
    label: report.value?.total_all_orders != null ? 'Total Orders' : 'Orders Paid',
    value: report.value?.total_all_orders ?? report.value?.total_orders ?? 0,
    icon: ShoppingBagIcon,
  },
  { label: 'Completed', value: report.value?.completed_orders ?? '—', icon: CheckCircleIcon },
  { label: 'Cancelled orders', value: report.value?.cancelled_orders ?? '—', icon: XCircleIcon },
])
async function exportReport(kind) {
  if (!report.value || loading.value || loadError.value || exporting.value) return
  const filename = `report-${loadedRange.value.from}-${loadedRange.value.to}`
  const data = {
    filename,
    brand: restaurant.name,
    logo: restaurant.logo,
    currency: currency.value,
    range: { ...loadedRange.value, groupBy: reportGrouping.value },
    report: report.value,
  }
  exporting.value = true
  try {
    if (kind === 'excel') await exportReportExcel(data)
    else await exportReportPdf(data)
  } catch (error) {
    toast.error(error.message || 'Unable to export report. Please try again.')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6 py-2">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
        {{ $t('Reports') }}
      </h1>
      <div class="flex flex-wrap items-center gap-2">
        <select
          :value="activePreset"
          :aria-label="$t('Date range')"
          class="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 focus:outline-2 focus:outline-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          @change="applyPreset($event.target.value)"
        >
          <option v-for="preset in PRESETS" :key="preset" :value="preset">{{ $t(preset) }}</option>
        </select>
        <span
          v-if="loadedRange"
          class="hidden border-r border-slate-300 px-3 text-xs text-slate-500 md:inline"
          >{{ loadedRange.from }} — {{ loadedRange.to }}</span
        >
        <button
          type="button"
          :disabled="loading || exporting"
          :aria-label="$t('Refresh')"
          :title="$t('Refresh')"
          class="grid h-11 w-11 place-items-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          @click="fetchReport"
        >
          <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          v-for="action in EXPORT_ACTIONS"
          :key="action.kind"
          type="button"
          :disabled="!report || loading || !!loadError || exporting"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          @click="exportReport(action.kind)"
        >
          <component :is="action.icon" class="h-4 w-4" />{{ action.label }}
        </button>
      </div>
    </header>
    <div v-if="activePreset === 'Custom'" class="flex flex-wrap gap-4">
      <label class="text-sm text-slate-600 dark:text-slate-300"
        >{{ $t('From')
        }}<input
          v-model="from"
          type="date"
          :max="to"
          class="ml-2 rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
      /></label>
      <label class="text-sm text-slate-600 dark:text-slate-300"
        >{{ $t('To')
        }}<input
          v-model="to"
          type="date"
          :min="from"
          class="ml-2 rounded-xl border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
      /></label>
    </div>
    <p v-if="loadError" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {{ $t(loadError) }}
      <button class="ml-2 underline" @click="fetchReport">{{ $t('Try again') }}</button>
    </p>
    <div v-if="loading && !report" class="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <div
        v-for="n in 5"
        :key="n"
        class="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
      />
    </div>
    <div v-else-if="report" class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="surface-card flex min-w-0 items-center gap-3 p-4"
        :title="$t(metric.label)"
      >
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-300"
          ><component :is="metric.icon" class="h-6 w-6" stroke-width="1.7" aria-hidden="true"
        /></span>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-600 dark:text-slate-300">
            {{ $t(METRIC_NAMES[metric.label] || metric.label) }}
          </p>
          <strong
            class="mt-1 block break-words text-2xl font-bold tracking-tight text-slate-950 dark:text-white"
            :title="metric.value === '—' ? $t('Not available') : undefined"
            >{{ metric.value }}</strong
          >
        </div>
      </div>
    </div>
    <div
      class="inline-flex w-fit rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900"
      role="tablist"
      :aria-label="$t('Reports')"
      @keydown="navigateTabs"
    >
      <button
        v-for="tab in REPORT_TABS"
        :id="`report-${tab}-tab`"
        :key="tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab"
        :tabindex="activeTab === tab ? 0 : -1"
        :aria-controls="`report-${tab}`"
        class="inline-flex min-h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary-500"
        :class="
          activeTab === tab
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-slate-500 hover:text-primary-600 dark:text-slate-300'
        "
        @click="activeTab = tab"
      >
        <component
          :is="tab === 'overview' ? ChartBarIcon : TableCellsIcon"
          class="h-4 w-4"
          aria-hidden="true"
        />{{ $t(tab === 'overview' ? 'Overview' : 'Details') }}
      </button>
    </div>
    <div
      v-if="loading"
      class="h-1 animate-pulse rounded-full bg-primary-200"
      :aria-label="$t('Loading...')"
    />
    <div
      v-if="activeTab === 'overview'"
      id="report-overview"
      role="tabpanel"
      aria-labelledby="report-overview-tab"
      class="space-y-5"
      :aria-busy="loading"
    >
      <div class="grid min-w-0 gap-5 xl:grid-cols-3">
        <ReportTrend
          class="xl:col-span-2"
          title="Revenue"
          :points="series"
          :currency="currency"
          :grouping="reportGrouping"
        />
        <ReportTrend
          title="Orders"
          kind="bars"
          :points="report?.orders_series || []"
          :grouping="reportGrouping"
        />
      </div>
      <div class="grid min-w-0 gap-5 lg:grid-cols-2">
        <section class="surface-card min-w-0 p-5 sm:p-6" :aria-label="$t('Sales by category')">
          <h2 class="mb-6 text-base font-bold">{{ $t('Categories') }}</h2>
          <p v-if="!categories.length" class="py-8 text-center text-sm text-slate-500">
            {{ $t('No data yet') }}
          </p>
          <div v-else class="max-h-72 space-y-5 overflow-y-auto pr-1">
            <div
              v-for="category in categories"
              :key="category.name"
              class="grid grid-cols-[minmax(0,1fr)_minmax(40px,2fr)_auto] items-center gap-4"
            >
              <span class="break-words text-sm font-medium">{{
                category.name === 'Uncategorized' ? $t('Uncategorized') : category.name
              }}</span>
              <div class="h-2.5 overflow-hidden rounded-full bg-primary-50 dark:bg-primary-950">
                <div
                  class="h-full rounded-full bg-primary-400"
                  :style="{ width: barWidth(category.sales, categories, 'sales') }"
                />
              </div>
              <strong class="text-sm tabular-nums">{{ money(category.sales) }}</strong>
            </div>
          </div>
        </section>
        <section
          class="surface-card min-w-0 p-5 sm:p-6"
          :aria-label="$t('Top 5 best-selling products')"
        >
          <header class="mb-6 flex items-center justify-between gap-3">
            <h2 class="text-base font-bold">{{ $t('Best sellers') }}</h2>
            <button
              type="button"
              class="text-xs font-semibold text-primary-600 hover:underline"
              :aria-label="$t('View all')"
              @click="viewProducts"
            >
              {{ $t('View all') }} →
            </button>
          </header>
          <p v-if="!bestSellers.length" class="py-8 text-center text-sm text-slate-500">
            {{ $t('No data yet') }}
          </p>
          <ol v-else class="space-y-4">
            <li
              v-for="(product, index) in bestSellers"
              :key="product.id"
              class="flex items-center gap-3"
            >
              <span
                class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-bold text-primary-600 dark:bg-primary-950"
                >{{ index + 1 }}</span
              ><span class="min-w-0 flex-1 break-words text-sm font-semibold">{{
                product.name
              }}</span>
              <div
                class="hidden h-2 w-1/3 overflow-hidden rounded-full bg-primary-50 sm:block dark:bg-primary-950"
              >
                <div
                  class="h-full rounded-full bg-primary-400"
                  :style="{ width: barWidth(product.quantity, bestSellers, 'quantity') }"
                />
              </div>
              <strong
                class="min-w-7 text-right text-sm tabular-nums"
                :title="$t('Quantity sold')"
                >{{ product.quantity }}</strong
              >
            </li>
          </ol>
        </section>
      </div>
    </div>
    <section
      v-else
      id="report-details"
      role="tabpanel"
      aria-labelledby="report-details-tab"
      class="surface-card min-w-0 p-5 sm:p-6"
    >
      <header class="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in DETAIL_TABS"
            :key="tab"
            type="button"
            :aria-pressed="detailTab === tab"
            class="rounded-lg px-3 py-2 text-sm font-semibold"
            :class="
              detailTab === tab
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-200'
                : 'text-slate-500'
            "
            @click="detailTab = tab"
          >
            {{ $t(tab === 'daily' ? 'Daily sales summary' : 'Product sales details') }}
          </button>
        </div>
        <input
          v-if="detailTab === 'products'"
          v-model="productSearch"
          type="search"
          :aria-label="$t('Search products…')"
          :placeholder="$t('Search products…')"
          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm sm:w-60 dark:border-slate-600 dark:bg-slate-900"
        />
      </header>
      <p v-if="detailTab === 'products'" class="mb-4 text-xs text-slate-500">
        {{ $t('Paid items, after discounts and before tax.') }}
      </p>
      <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <caption class="sr-only">
            {{
              $t(detailTab === 'daily' ? 'Daily sales summary' : 'Product sales details')
            }}
          </caption>
          <thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
            <tr>
              <th
                v-for="label in DETAIL_COLUMNS[detailTab]"
                :key="label"
                class="whitespace-nowrap px-4 py-3 font-semibold"
              >
                {{ $t(label) }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="row in visibleDetails"
              :key="row.period || row.id"
              class="hover:bg-primary-50/30 dark:hover:bg-slate-800/40"
            >
              <template v-if="detailTab === 'daily'"
                ><td class="whitespace-nowrap px-4 py-3">{{ row.period }}</td>
                <td class="px-4 py-3 font-semibold text-primary-700 dark:text-primary-300">
                  {{ money(row.revenue) }}
                </td>
                <td class="px-4 py-3 tabular-nums">{{ row.paid_invoices }}</td>
                <td class="px-4 py-3 tabular-nums">{{ row.orders_count }}</td></template
              ><template v-else
                ><td class="px-4 py-3 font-medium">{{ row.name }}</td>
                <td class="px-4 py-3">
                  {{ row.category === 'Uncategorized' ? $t('Uncategorized') : row.category }}
                </td>
                <td class="px-4 py-3 tabular-nums">{{ row.quantity }}</td>
                <td class="px-4 py-3 font-semibold text-primary-700 dark:text-primary-300">
                  {{ money(row.sales) }}
                </td></template
              >
            </tr>
            <tr v-if="!visibleDetails.length">
              <td colspan="4" class="px-4 py-10 text-center text-slate-500">
                {{ $t('No data yet') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav
        v-if="detailPages > 1"
        :aria-label="$t('Pagination')"
        class="mt-5 flex items-center justify-end gap-4 text-sm"
      >
        <button
          :disabled="detailPage === 1"
          class="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-30"
          @click="detailPage--"
        >
          {{ $t('Previous') }}</button
        ><span>{{ detailPage }} / {{ detailPages }}</span
        ><button
          :disabled="detailPage === detailPages"
          class="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-30"
          @click="detailPage++"
        >
          {{ $t('Next') }}
        </button>
      </nav>
    </section>
  </div>
</template>
