<script setup>
import { PencilIcon, TrashIcon, TagIcon } from '@heroicons/vue/24/outline'

defineProps({ category: { type: Object, required: true } })
defineEmits(['edit', 'delete'])
</script>

<template>
  <div class="card flex items-center gap-4 p-4">
    <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
      <img v-if="category.image" :src="category.image" :alt="category.name" class="h-full w-full object-cover" />
      <TagIcon v-else class="h-6 w-6 text-slate-400" />
    </div>

    <div class="flex-1">
      <p class="font-semibold text-slate-900 dark:text-slate-100">{{ category.name }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        {{ category.products?.length ?? 0 }} {{ $t('products ·') }}
        <span :class="category.is_active ? 'text-success-600' : 'text-slate-400'">
          {{ category.is_active ? $t("Active") : $t("Inactive") }}
        </span>
      </p>
    </div>

    <div class="flex gap-1.5">
      <button class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" @click="$emit('edit', category)">
        <PencilIcon class="h-4 w-4" />
      </button>
      <button class="rounded-lg p-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10" @click="$emit('delete', category)">
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
