<script setup>
import { computed } from 'vue'
import { kitchenItem, kitchenText } from '../../utils/kitchenItems'
const props = defineProps({
  item: { type: Object, required: true },
  showQuantity: Boolean,
  showNotes: { type: Boolean, default: true },
})
const details = computed(() =>
  kitchenItem({ ...props.item, product_name: props.item.product_name || props.item.name }),
)
</script>

<template>
  <div class="min-w-0 space-y-1.5 [overflow-wrap:anywhere]">
    <p class="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
      <span v-if="showQuantity">{{ item.quantity }}× </span>{{ details.name }}
    </p>
    <p v-if="details.description" class="whitespace-pre-wrap text-xs text-slate-500">
      {{ details.description }}
    </p>
    <div
      v-if="details.size"
      class="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
    >
      <strong>{{ $t('Size') }}:</strong> {{ details.size }}
    </div>
    <div
      v-if="details.toppings.length"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
    >
      <strong>{{ $t('Toppings') }}:</strong>
      <ul class="mt-1 space-y-1">
        <li v-for="(topping, index) in details.toppings" :key="index">+ {{ topping }}</li>
      </ul>
    </div>
    <p v-if="showNotes && item.notes" class="whitespace-pre-wrap text-xs text-slate-500">
      {{ kitchenText(item.notes) }}
    </p>
  </div>
</template>
