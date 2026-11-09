<script setup>
import { computed } from 'vue'
import Modal from '../ui/Modal.vue'
import { t } from '../../languages'
import { formatCurrency, formatDateTime } from '../../utils/format'

const props = defineProps({
  record: { type: Object, default: null },
  kind: { type: String, required: true },
})
defineEmits(['close'])

const rows = computed(() => {
  const item = props.record
  if (!item) return []
  const active = t(item.is_active ? 'Active' : 'Inactive')
  const fields = {
    tables: [
      ['Table number', item.table_number],
      ['Seats', item.capacity],
      ['Status', t(item.status)],
    ],
    categories: [
      ['Name', item.name],
      ['Status', active],
      ['Product quantity', item.products_count ?? item.products?.length],
    ],
    products: [
      ['Name', item.name],
      ['Category', item.category?.name],
      ['Description', item.description],
      ['Price', formatCurrency(item.price)],
      ['Discount (%)', item.discount_percent],
      ['Status', t(item.available ? 'Available' : 'Unavailable')],
      ['Preparation time (minutes)', item.preparation_time],
    ],
    users: [
      ['Name', item.name],
      ['Email', item.email],
      ['Role', t(item.role)],
      ['Status', active],
    ],
  }
  return [
    ...(fields[props.kind] || []),
    ['Created at', formatDateTime(item.created_at)],
    ['Updated at', formatDateTime(item.updated_at)],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
})
</script>

<template>
  <Modal
    :model-value="Boolean(record)"
    :title="$t('View details')"
    @update:model-value="!$event && $emit('close')"
  >
    <div v-if="record" class="flex flex-col gap-5">
      <img
        v-if="record.image"
        :src="record.image"
        :alt="record.name"
        class="max-h-60 w-full rounded-xl object-contain"
      />
      <dl class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="[label, value] in rows"
          :key="label"
          class="grid grid-cols-2 gap-4 py-3 text-sm"
        >
          <dt class="text-slate-500 dark:text-slate-400">{{ $t(label) }}</dt>
          <dd
            class="whitespace-pre-wrap break-words font-medium text-slate-900 dark:text-slate-100"
          >
            {{ value }}
          </dd>
        </div>
      </dl>
      <template v-if="kind === 'products'">
        <section v-for="key in ['sizes', 'toppings']" :key="key">
          <h4 class="mb-2 text-sm font-semibold">
            {{ $t(key === 'sizes' ? 'Sizes' : 'Toppings') }}
          </h4>
          <ul v-if="record[key]?.length" class="space-y-2 text-sm">
            <li v-for="option in record[key]" :key="option.name" class="flex justify-between gap-4">
              <span>{{ option.name }}</span
              ><span>{{ formatCurrency(option.price) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-500">—</p>
        </section>
      </template>
      <button type="button" class="customer-primary w-full" @click="$emit('close')">
        {{ $t('Close') }}
      </button>
    </div>
  </Modal>
</template>
