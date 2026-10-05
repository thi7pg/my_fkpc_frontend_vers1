<script setup>
import { onMounted, computed } from 'vue'
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ClockIcon,
  FireIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline'
import { useDashboardStore } from '../../stores/dashboard'
import { useAuthStore } from '../../stores/auth'
import DashboardCard from '../../components/staff/DashboardCard.vue'
import OrderCard from '../../components/staff/OrderCard.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { formatCurrency } from '../../utils/format'

const dashboard = useDashboardStore()
const auth = useAuthStore()

onMounted(() => dashboard.fetchSummary())

const summary = computed(() => dashboard.summary)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100"> {{ $t("Welcome back,") }} {{
        auth.user?.name?.split(' ')[0] }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ $t("Here's what's happening today.") }}</p>
    </div>

    <div v-if="dashboard.loading" class="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <SkeletonLoader variant="card" :count="5" />
    </div>



    <template v-else-if="summary">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <DashboardCard :label="$t('Today\'s Revenue')" :value="formatCurrency(summary.today_revenue)"
          :icon="CurrencyDollarIcon" tone="success" />
        <DashboardCard :label="$t('Orders Today')" :value="summary.today_orders" :icon="ShoppingBagIcon"
          tone="primary" />
        <DashboardCard :label="$t('Pending')" :value="summary.pending_orders" :icon="ClockIcon"
          tone="warning" />
        <DashboardCard :label="$t('Preparing')" :value="summary.preparing_orders" :icon="FireIcon"
          tone="primary" />
        <DashboardCard :label="$t('Completed')" :value="summary.completed_orders" :icon="CheckCircleIcon"
          tone="slate" />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <h2 class="mb-3 font-semibold text-slate-900 dark:text-slate-100">{{ $t("Recent Orders") }}</h2>
          <EmptyState v-if="!summary.recent_orders?.length" :title="$t('No recent orders')" />
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <OrderCard v-for="order in summary.recent_orders" :key="order.id" :order="order" />
          </div>
        </div>

        <div>
          <h2 class="mb-3 font-semibold text-slate-900 dark:text-slate-100">{{ $t("Popular Products") }}</h2>
          <div class="card divide-y divide-slate-100 dark:divide-slate-800">
            <EmptyState v-if="!summary.popular_menu?.length" :title="$t('No data yet')" />
            <div v-for="(product, index) in summary.popular_menu" :key="product.product_id"
              class="flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600 dark:bg-primary-500/10">
                  {{ index + 1 }}
                </span>
                <span class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ product.name }}</span>
              </div>
              <span class="text-xs text-slate-400">{{ product.total_quantity_sold }} {{ $t("sold") }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
