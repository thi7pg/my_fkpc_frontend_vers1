<script setup>
defineProps({
  size: { type: String, default: 'md' }, // sm | md | lg
})

const sizes = { sm: 'h-4 w-4 border-2', md: 'h-8 w-8 border-2', lg: 'h-12 w-12 border-[3px]' }
</script>

<template>
  <div
    class="inline-block animate-spin rounded-full border-primary-600 border-t-transparent dark:border-primary-400 dark:border-t-transparent"
    :class="sizes[size]"
    role="status"
    :aria-label="$t('Loading')"
  />
</template>
