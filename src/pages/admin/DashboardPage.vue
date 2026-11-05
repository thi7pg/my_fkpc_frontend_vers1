<script setup>
import { onMounted, computed, ref } from 'vue'
import {
  BanknotesIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import { useDashboardStore } from '../../stores/dashboard'
import { useAuthStore } from '../../stores/auth'
import { useRestaurantStore } from '../../stores/restaurant'
import { STATUS_LABELS, STATUS_STYLES } from '../../utils/orderStatus'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { formatCurrency, formatTime, formatDateTime } from '../../utils/format'

const dashboard = useDashboardStore()
const auth = useAuthStore()
const restaurant = useRestaurantStore()
const activeFilter = ref('')
const filters = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
]
const summary = computed(() => dashboard.summary)
const money = (value) => formatCurrency(value, restaurant.settings.currency || 'USD')
const visibleOrders = computed(() =>
  (summary.value?.recent_orders || []).filter(
    (order) => !activeFilter.value || order.status === activeFilter.value,
  ),
)
const metrics = computed(() => [
  {
    label: "Today's Revenue",
    value: money(summary.value?.today_revenue || 0),
    icon: BanknotesIcon,
  },
  { label: 'Orders Today', value: summary.value?.today_orders ?? 0, icon: ShoppingBagIcon },
  { label: 'Pending', value: summary.value?.pending_orders ?? 0, icon: ClockIcon },
  { label: 'Completed', value: summary.value?.completed_orders ?? 0, icon: CheckCircleIcon },
])
onMounted(() => dashboard.fetchSummary())
</script>

<template>
  <div class="overview-dashboard">
    <section class="overview-welcome" :aria-label="$t('Dashboard')">
      <h1>{{ $t('Welcome back,') }} {{ auth.user?.name?.split(' ')[0] }}</h1>
      <p>{{ $t("Here's what's happening today.") }}</p>
      <div v-if="dashboard.loading" class="overview-metrics" aria-busy="true">
        <SkeletonLoader variant="card" :count="4" />
      </div>
      <div v-else-if="summary && !dashboard.error" class="overview-metrics">
        <div v-for="metric in metrics" :key="metric.label" class="overview-metric">
          <span class="overview-metric-icon"><component :is="metric.icon" /></span>
          <div>
            <p>{{ $t(metric.label) }}</p>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
      </div>
    </section>

    <EmptyState
      v-if="dashboard.error"
      :title="$t('Something went wrong')"
      :message="dashboard.error"
    >
      <button class="customer-primary mt-4" @click="dashboard.fetchSummary">
        {{ $t('Try again') }}
      </button>
    </EmptyState>
    <div v-else-if="summary && !dashboard.loading" class="overview-content">
      <section class="surface-card overview-panel overview-orders">
        <div class="overview-panel-heading">
          <h2>{{ $t('Recent Orders') }}</h2>
          <div class="overview-filters" role="group" :aria-label="$t('Order status')">
            <button
              v-for="filter in filters"
              :key="filter.value"
              type="button"
              :aria-pressed="activeFilter === filter.value"
              @click="activeFilter = filter.value"
            >
              {{ $t(filter.label) }}
            </button>
          </div>
        </div>
        <EmptyState v-if="!visibleOrders.length" :title="$t('No recent orders')" />
        <div v-else class="overview-order-grid">
          <article v-for="order in visibleOrders" :key="order.id" class="overview-order">
            <div class="overview-order-heading">
              <div class="min-w-0">
                <h3>#{{ order.order_number }}</h3>
                <p>
                  {{ $t('Table') }}
                  {{
                    typeof order.table === 'object'
                      ? (order.table?.table_number ?? '—')
                      : (order.table ?? '—')
                  }}
                </p>
              </div>
              <span class="overview-status" :class="STATUS_STYLES[order.status]">
                {{ $t(STATUS_LABELS[order.status] || order.status) }}
              </span>
            </div>
            <div class="overview-order-footer">
              <span :title="formatDateTime(order.created_at)"
                ><ClockIcon />{{ formatTime(order.created_at) }}</span
              >
              <strong>{{ money(order.total_amount) }}</strong>
            </div>
          </article>
        </div>
      </section>
      <section class="surface-card overview-panel overview-popular">
        <div class="overview-panel-heading">
          <h2>{{ $t('Popular Products') }}</h2>
        </div>
        <EmptyState v-if="!summary.popular_menu?.length" :title="$t('No data yet')" />
        <ol v-else class="overview-product-list">
          <li v-for="(product, index) in summary.popular_menu" :key="product.product_id">
            <span class="overview-rank">{{ index + 1 }}</span>
            <span class="overview-product-name">{{ product.name }}</span>
            <span class="overview-sold">{{ product.total_quantity_sold }} {{ $t('sold') }}</span>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overview-dashboard {
  display: flex;
  flex-direction: column;
  gap: 30px;
  padding: 10px 4px;
}
.overview-welcome {
  padding: 30px 24px 26px;
  border-radius: 22px;
  background: linear-gradient(110deg, #d50036 0%, #be0032 48%, #980029 100%);
  color: white;
}
.overview-welcome h1 {
  font-size: clamp(25px, 2.6vw, 36px);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.8px;
  margin: 0 8px;
}
.overview-welcome > p {
  margin: 12px 8px 30px;
  color: #ffe1e9;
  font-size: 16px;
}
.overview-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.overview-metric {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 26px 20px;
  min-width: 0;
  border: 1px solid #ffffff55;
  border-radius: 20px;
  background: #ffffff2b;
  box-shadow: inset 0 0 0 1px #ffffff0d;
}
.overview-metric-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 11px;
  background: #ffffff55;
}
.overview-metric-icon svg {
  width: 31px;
  height: 31px;
  stroke-width: 1.5;
}
.overview-metric p {
  color: #ffe5ed;
  font-size: 14px;
  margin-bottom: 10px;
}
.overview-metric strong {
  display: block;
  font-size: clamp(22px, 2vw, 28px);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.overview-content {
  display: grid;
  grid-template-columns: minmax(0, 2.15fr) minmax(260px, 1fr);
  gap: 28px;
}
.overview-panel {
  min-width: 0;
  padding: 20px 16px;
  border-radius: 20px;
}
.overview-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.overview-panel h2 {
  font-size: 16px;
  font-weight: 650;
}
.overview-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.overview-filters button {
  border: 1px solid #b9bdc1;
  border-radius: 999px;
  padding: 5px 11px;
  color: #646b74;
  font-size: 12px;
  font-weight: 600;
  background: white;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.overview-filters button:hover {
  background: #fff0f4;
}
.overview-filters button[aria-pressed='true'] {
  background: #fff0f4;
  border-color: #d62150;
  color: #ce0233;
}
.overview-filters button:focus-visible {
  outline: 2px solid #ce0233;
  outline-offset: 3px;
}
.overview-order-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.overview-order {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
  min-height: 116px;
  padding: 15px;
  border-radius: 15px;
  background: white;
  border: 1px solid #e8eaed;
  box-shadow: 0 1px 3px #16233b0b;
}
.overview-order-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.overview-order h3 {
  font-size: 13px;
  font-weight: 750;
  overflow-wrap: anywhere;
}
.overview-order p {
  font-size: 11px;
  color: #7b8796;
  margin-top: 3px;
}
.overview-status {
  flex-shrink: 0;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
}
.overview-order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid #f1f3f5;
  padding-top: 10px;
  font-size: 11px;
}
.overview-order-footer > span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #8a97a7;
}
.overview-order-footer svg {
  width: 13px;
  height: 13px;
}
.overview-order-footer strong {
  font-weight: 650;
}
.overview-product-list {
  border: 1px solid #e8eaed;
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 3px #16233b0b;
  overflow: hidden;
}
.overview-product-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 12px;
}
.overview-product-list li + li {
  border-top: 1px solid #f1f3f5;
}
.overview-rank {
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #fff0f3;
  color: #ce0233;
  font-size: 11px;
  font-weight: 700;
}
.overview-product-name {
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.overview-sold {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  color: #8a97a7;
}
:global(.dark) .overview-panel {
  border-color: #475569;
  box-shadow: none;
}
:global(.dark) .overview-order,
:global(.dark) .overview-product-list {
  background: #0f172a;
  border-color: #334155;
}
:global(.dark) .overview-order-footer,
:global(.dark) .overview-product-list li + li {
  border-color: #1e293b;
}
:global(.dark) .overview-filters button {
  background: #0f172a;
  color: #cbd5e1;
  border-color: #475569;
}
:global(.dark) .overview-filters button[aria-pressed='true'] {
  background: #4c1127;
  color: #ffa5bd;
  border-color: #e51c4b;
}
@media (max-width: 1200px) {
  .overview-metric {
    padding: 22px 14px;
    gap: 12px;
  }
  .overview-metric-icon {
    width: 42px;
    height: 42px;
  }
  .overview-metric-icon svg {
    width: 27px;
    height: 27px;
  }
  .overview-content {
    gap: 20px;
    grid-template-columns: minmax(0, 1.8fr) minmax(240px, 1fr);
  }
}
@media (max-width: 1000px) {
  .overview-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-content {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 540px) {
  .overview-dashboard {
    padding: 0;
    gap: 20px;
  }
  .overview-welcome {
    padding: 24px 16px 18px;
    border-radius: 18px;
  }
  .overview-welcome h1 {
    margin: 0;
    letter-spacing: -0.5px;
  }
  .overview-welcome > p {
    margin: 10px 0 22px;
    font-size: 13px;
  }
  .overview-metrics {
    gap: 10px;
  }
  .overview-metric {
    padding: 16px 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    border-radius: 14px;
  }
  .overview-metric p {
    font-size: 12px;
    margin-bottom: 6px;
  }
  .overview-metric strong {
    font-size: 23px;
  }
  .overview-order-grid {
    grid-template-columns: 1fr;
  }
  .overview-panel {
    padding: 18px 14px;
  }
  .overview-panel-heading {
    gap: 12px;
  }
  .overview-filters {
    gap: 6px;
  }
  .overview-filters button {
    min-height: 36px;
    padding: 5px 10px;
  }
}
</style>
