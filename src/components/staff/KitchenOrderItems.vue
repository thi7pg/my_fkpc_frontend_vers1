<script setup>
import { computed, ref } from 'vue'
import { kitchenItem, kitchenText } from '../../utils/kitchenItems'

const props = defineProps({ items: { type: Array, default: () => [] }, large: Boolean })
const displayItems = computed(() =>
  props.items.map((item) => ({ ...item, display: kitchenItem(item) })),
)
const failedImages = ref(new Set())
function photo(item) {
  return item.product?.image || item.product_image || item.image || ''
}
</script>

<template>
  <ul class="flex flex-col gap-4 border-y border-slate-200 py-3 dark:border-slate-700">
    <li v-for="item in displayItems" :key="item.id">
      <div class="flex items-center gap-3.5">
        <div
          class="shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
          :class="large ? 'h-25 w-25 min-[401px]:h-32 min-[401px]:w-32' : 'h-22 w-22'"
        >
          <img
            v-if="photo(item) && !failedImages.has(photo(item))"
            :src="photo(item)"
            :alt="item.display.name"
            loading="lazy"
            class="h-full w-full object-cover"
            @error="failedImages.add(photo(item))"
          />
          <span
            v-else
            class="flex h-full flex-col items-center justify-center text-[26px] text-slate-500 dark:text-slate-400"
            ><span aria-hidden="true">🍽️</span
            ><small class="text-xs">{{ $t('No photo') }}</small></span
          >
        </div>
        <div class="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]">
          <strong class="block text-[26px] leading-8" style="color: var(--column-color, #d97706)"
            >{{ item.quantity }}×</strong
          >
          <p class="whitespace-pre-wrap text-lg leading-relaxed text-slate-900 dark:text-slate-100">
            {{ item.display.name }}
          </p>
          <p
            v-if="item.display.description"
            class="whitespace-pre-wrap text-base text-slate-600 dark:text-slate-300"
          >
            {{ item.display.description }}
          </p>
          <div
            v-if="item.display.size"
            class="rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-2 text-base text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
          >
            <strong>{{ $t('Size') }}:</strong> {{ item.display.size }}
          </div>
          <div
            v-if="item.display.toppings.length"
            class="rounded-lg border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-base text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"
          >
            <strong>{{ $t('Toppings') }}:</strong>
            <ul class="mt-1 flex flex-col gap-1">
              <li v-for="(topping, index) in item.display.toppings" :key="index">
                + {{ topping }}
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p
        v-if="item.notes"
        class="mt-2.5 whitespace-pre-wrap rounded-md border-l-4 border-warning-500 bg-warning-50 px-3 py-2.5 text-base leading-6 text-amber-800 [overflow-wrap:anywhere] dark:bg-warning-500/10 dark:text-warning-500"
      >
        <strong>{{ $t('Note:') }}</strong> {{ kitchenText(item.notes) }}
      </p>
    </li>
  </ul>
</template>
