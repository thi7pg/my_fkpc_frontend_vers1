<script setup>
import { computed } from 'vue'
import { EyeIcon, PencilIcon, TrashIcon, TagIcon } from '@heroicons/vue/24/outline'

const props = defineProps({ category: { type: Object, required: true } })
defineEmits(['view', 'edit', 'delete'])

const productCount = computed(
  () =>
    props.category.products_count ??
    (Array.isArray(props.category.products) ? props.category.products.length : null),
)
</script>

<template>
  <div class="card flex items-center gap-4 p-4">
    <div
      class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
    >
      <img
        v-if="category.image"
        :src="category.image"
        :alt="category.name"
        class="h-full w-full object-cover"
      />
      <TagIcon v-else class="h-6 w-6 text-slate-400" />
    </div>

    <div class="flex-1">
      <p class="font-semibold text-slate-900 dark:text-slate-100">{{ category.name }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        <span v-if="productCount !== null">{{ productCount }} {{ $t('products ·') }} </span>
        <span :class="category.is_active ? 'text-success-600' : 'text-slate-400'">
          {{ category.is_active ? $t('Active') : $t('Inactive') }}
        </span>
      </p>
    </div>

    <div class="flex gap-1.5">
      <button
        type="button"
        :aria-label="$t('View details')"
        :title="$t('View details')"
        class="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="$emit('view', category)"
      >
        <EyeIcon class="h-4 w-4" /><span>{{ $t('View details') }}</span>
      </button>
      <button
        class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        @click="$emit('edit', category)"
      >
        <PencilIcon class="h-4 w-4" />
      </button>
      <button
        class="rounded-lg p-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
        @click="$emit('delete', category)"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
