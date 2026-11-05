<script setup>
import { computed, ref, watch, useId } from 'vue'
import { t, intlLocale } from '../../languages'
import { formatCurrency } from '../../utils/format'

const props = defineProps({
  title: String,
  points: { type: Array, default: () => [] },
  kind: { type: String, default: 'area' },
  currency: { type: String, default: 'USD' },
  grouping: { type: String, default: 'day' },
})
const gradient = useId().replaceAll(':', '')
const selected = ref(0)
watch(
  () => props.points,
  () => {
    selected.value = Math.max(0, props.points.length - 1)
  },
)
const value = (point) => Number((props.kind === 'area' ? point?.revenue : point?.orders_count) || 0)
const maximum = computed(() => {
  const maximum = Math.max(1, ...props.points.map(value))
  if (props.kind !== 'area') return Math.max(4, Math.ceil(maximum / 4) * 4)
  const step = 10 ** Math.floor(Math.log10(maximum))
  return Math.ceil(maximum / step) * step
})
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => (maximum.value * i) / 4))
const formatted = (number) =>
  props.kind === 'area'
    ? formatCurrency(number, props.currency)
    : new Intl.NumberFormat(intlLocale()).format(number)
function label(period) {
  if (props.grouping === 'week') return period
  const [year, month, day = 1] = String(period).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(
    intlLocale(),
    props.grouping === 'month'
      ? { month: 'short', year: '2-digit' }
      : { month: 'short', day: 'numeric' },
  )
}
const points = computed(() =>
  props.points.map((point, index) => ({
    x: ((index + 0.5) / props.points.length) * 1000,
    y: 200 - (value(point) / maximum.value) * 200,
  })),
)
const line = computed(() =>
  points.value
    .map((point, index, all) => {
      if (!index) return `M ${point.x} ${point.y}`
      const before = all[index - 1],
        middle = (before.x + point.x) / 2
      return `C ${middle} ${before.y} ${middle} ${point.y} ${point.x} ${point.y}`
    })
    .join(' '),
)
const area = computed(() =>
  points.value.length
    ? `${line.value} L ${points.value.at(-1).x} 200 L ${points.value[0].x} 200 Z`
    : '',
)
const current = computed(() => props.points[selected.value] || props.points[0])
</script>

<template>
  <section class="surface-card min-w-0 p-5 sm:p-6" :aria-label="t(title)">
    <header class="mb-5 flex min-h-10 flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ t(title) }}</h2>
      <span
        v-if="current"
        class="rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-200"
        >{{ label(current.period) }} · {{ formatted(value(current)) }}</span
      >
    </header>
    <div v-if="!points.length" class="grid h-60 place-items-center text-sm text-slate-500">
      {{ t('No data yet') }}
    </div>
    <div v-else class="flex gap-3 pt-4">
      <div
        class="relative h-[200px] w-12 shrink-0 text-right text-[10px] tabular-nums text-slate-500"
        aria-hidden="true"
      >
        <span
          v-for="tick in ticks"
          :key="tick"
          class="absolute right-0 translate-y-1/2"
          :style="{ bottom: (tick / maximum) * 100 + '%' }"
          >{{ formatted(tick) }}</span
        >
      </div>
      <div class="min-w-0 flex-1 overflow-x-auto pb-2">
        <div :style="{ minWidth: points.length > 12 ? points.length * 42 + 'px' : '0' }">
          <div class="relative h-[200px] border-b border-slate-200 dark:border-slate-700">
            <div class="pointer-events-none absolute inset-0" aria-hidden="true">
              <span
                v-for="tick in ticks.slice(1)"
                :key="tick"
                class="absolute inset-x-0 border-t border-dashed border-slate-200/80 dark:border-slate-700"
                :style="{ bottom: (tick / maximum) * 100 + '%' }"
              />
            </div>
            <svg
              v-if="kind === 'area'"
              class="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-primary-600 dark:text-primary-400"
              viewBox="0 0 1000 200"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient :id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
                  <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path :d="area" :fill="`url(#${gradient})`" />
              <path
                :d="line"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                vector-effect="non-scaling-stroke"
                stroke-linecap="round"
              />
            </svg>
            <div class="relative flex h-full">
              <button
                v-for="(point, index) in props.points"
                :key="point.period"
                type="button"
                class="relative flex min-w-0 flex-1 items-end justify-center rounded-t-lg focus-visible:outline-2 focus-visible:outline-primary-500"
                :aria-label="`${label(point.period)}, ${t(title)}: ${formatted(value(point))}`"
                :aria-pressed="selected === index"
                @mouseenter="selected = index"
                @focus="selected = index"
                @click="selected = index"
              >
                <span
                  v-if="kind === 'area'"
                  class="absolute h-3 w-3 translate-y-1/2 rounded-full border-2 border-white bg-primary-500 dark:border-slate-900"
                  :class="{ 'ring-4 ring-primary-100 dark:ring-primary-900': selected === index }"
                  :style="{ bottom: (value(point) / maximum) * 100 + '%' }"
                  aria-hidden="true"
                />
                <span
                  v-else
                  class="w-3/5 max-w-12 rounded-t-md"
                  :class="
                    selected === index ? 'bg-primary-500' : 'bg-primary-200 dark:bg-primary-800'
                  "
                  :style="{ height: Math.max(0, (value(point) / maximum) * 200) + 'px' }"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
          <div class="mt-3 flex text-[10px] text-slate-500" aria-hidden="true">
            <span
              v-for="(point, index) in props.points"
              :key="point.period"
              class="min-w-0 flex-1 text-center"
              :class="{ 'font-semibold text-primary-600': selected === index }"
              >{{
                props.points.length <= 12 || index % Math.ceil(props.points.length / 10) === 0
                  ? label(point.period)
                  : ''
              }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
