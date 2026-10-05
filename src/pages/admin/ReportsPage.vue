<script setup>
import { t, intlLocale } from '../../i18n'
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { CurrencyDollarIcon, ShoppingBagIcon, ReceiptPercentIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
import { adminService } from '../../services/adminService'
import { formatCurrency } from '../../utils/format'
import DashboardCard from '../../components/staff/DashboardCard.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()

const PRESETS = [
  { label: 'Last 7 days', days: 6 },
  { label: 'Last 30 days', days: 29 },
  { label: 'Last 90 days', days: 89 },
]
const PLOT_HEIGHT = 180

const activePreset = ref(1)
const groupBy = ref('day')
const from = ref('')
const to = ref('')
const loading = ref(false)
const report = ref(null)
const showTable = ref(false)
const hovered = ref(null)

function toDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function applyPreset(index) {
  activePreset.value = index
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - PRESETS[index].days)
  to.value = toDateInput(end)
  from.value = toDateInput(start)
}

function useCustomRange() {
  activePreset.value = null
}

async function fetchReport() {
  loading.value = true
  try {
    const res = await adminService.reports.revenue({
      from: from.value,
      to: to.value,
      group_by: groupBy.value,
    })
    report.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  applyPreset(1)
  fetchReport()
})

watch(groupBy, fetchReport)
watch([from, to], () => {
  if (from.value && to.value) fetchReport()
})

const series = computed(() => report.value?.series ?? [])
const hasData = computed(() => series.value.some((p) => p.revenue > 0))
const maxRevenue = computed(() => Math.max(1, ...series.value.map((p) => p.revenue)))
const avgPerOrder = computed(() => {
  if (!report.value || report.value.total_orders === 0) return 0
  return report.value.total_revenue / report.value.total_orders
})

const yTicks = computed(() => {
  const max = niceCeil(maxRevenue.value)
  return [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
})

function niceCeil(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const residual = value / magnitude
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  return step * magnitude
}

function barHeight(value) {
  const max = yTicks.value[yTicks.value.length - 1]
  if (max <= 0) return 0
  return Math.max(value > 0 ? 2 : 0, (value / max) * PLOT_HEIGHT)
}

function formatCompact(value) {
  return new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function periodLabel(period) {
  if (!period) return ''
  if (groupBy.value === 'month') {
    const [y, m] = period.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(intlLocale(), { month: 'short', year: '2-digit' })
  }
  if (groupBy.value === 'week') {
    return period.replace('-W', ' Wk ')
  }
  return new Date(period).toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric' })
}

const xLabelStep = computed(() => Math.max(1, Math.ceil(series.value.length / 8)))
function showXLabel(index) {
  return index % xLabelStep.value === 0 || index === series.value.length - 1
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Reports") }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ $t("Revenue over time.") }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="(preset, index) in PRESETS"
        :key="preset.label"
        class="rounded-full px-4 py-2 text-sm font-medium transition"
        :class="
          activePreset === index
            ? 'bg-primary-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        "
        @click="applyPreset(index)"
      >
        {{ $t(preset.label) }}
      </button>

      <div class="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
        <input
          v-model="from"
          type="date"
          class="bg-transparent text-sm text-slate-700 focus:outline-none dark:text-slate-200"
          @change="useCustomRange"
        />
        <span class="text-slate-400">–</span>
        <input
          v-model="to"
          type="date"
          class="bg-transparent text-sm text-slate-700 focus:outline-none dark:text-slate-200"
          @change="useCustomRange"
        />
      </div>

      <select
        v-model="groupBy"
        class="ml-auto rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="day">{{ $t("By day") }}</option>
        <option value="week">{{ $t("By week") }}</option>
        <option value="month">{{ $t("By month") }}</option>
      </select>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div v-for="n in 3" :key="n" class="card h-20 animate-pulse" />
    </div>
    <div v-else-if="report" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <DashboardCard :label="$t('Total Revenue')" :value="formatCurrency(report.total_revenue)" :icon="CurrencyDollarIcon" tone="success" />
      <DashboardCard :label="$t('Orders Paid')" :value="report.total_orders" :icon="ShoppingBagIcon" tone="primary" />
      <DashboardCard :label="$t('Avg per Order')" :value="formatCurrency(avgPerOrder)" :icon="ReceiptPercentIcon" tone="slate" />
    </div>

    <div class="card p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-semibold text-slate-900 dark:text-slate-100">{{ $t("Revenue") }}</h2>
        <button
          v-if="hasData"
          class="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          @click="showTable = !showTable"
        >
          {{ showTable ? $t("View chart") : $t("View table") }}
        </button>
      </div>

      <div v-if="loading" class="h-[220px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />

      <EmptyState v-else-if="!hasData" :icon="ChartBarIcon" :title="$t('No revenue in this range')" :message="$t('Paid orders in the selected period will show up here.')" />

      <div v-else-if="!showTable" class="flex">
        <div class="flex h-[180px] w-12 shrink-0 flex-col justify-between pr-2 text-right text-[10px] tabular-nums text-slate-400">
          <span v-for="tick in [...yTicks].reverse()" :key="tick">{{ formatCompact(tick) }}</span>
        </div>

        <div class="relative flex-1">
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <span v-for="tick in yTicks" :key="tick" class="h-px w-full bg-slate-100 dark:bg-slate-800" />
          </div>

          <div class="relative flex h-[180px] items-end gap-[2px]">
            <div
              v-for="(point, i) in series"
              :key="point.period"
              class="group relative flex h-full flex-1 flex-col items-center justify-end"
              tabindex="0"
              @mouseenter="hovered = i"
              @mouseleave="hovered = null"
              @focus="hovered = i"
              @blur="hovered = null"
            >
              <div
                v-if="hovered === i"
                class="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg dark:bg-slate-100"
              >
                <p class="font-semibold text-white dark:text-slate-900">{{ formatCurrency(point.revenue) }}</p>
                <p class="text-slate-300 dark:text-slate-600">{{ point.orders_count }} {{ $t('orders ·') }} {{ periodLabel(point.period) }}</p>
              </div>
              <div
                class="w-full max-w-6 rounded-t bg-primary-600 transition-opacity dark:bg-primary-400"
                :class="hovered === i ? 'opacity-100' : 'opacity-90'"
                :style="{ height: barHeight(point.revenue) + 'px' }"
              />
            </div>
          </div>

          <div class="mt-2 flex gap-[2px] text-[10px] text-slate-400">
            <div v-for="(point, i) in series" :key="point.period" class="flex-1 text-center">
              <span v-if="showXLabel(i)">{{ periodLabel(point.period) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th class="py-2 font-medium">{{ $t("Period") }}</th>
              <th class="py-2 text-right font-medium">{{ $t("Revenue") }}</th>
              <th class="py-2 text-right font-medium">{{ $t("Orders") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in series" :key="point.period" class="border-b border-slate-100 dark:border-slate-800/60">
              <td class="py-2">{{ periodLabel(point.period) }}</td>
              <td class="py-2 text-right tabular-nums">{{ formatCurrency(point.revenue) }}</td>
              <td class="py-2 text-right tabular-nums">{{ point.orders_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
