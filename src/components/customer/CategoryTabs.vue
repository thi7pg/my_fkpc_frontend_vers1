<script setup>
import { Squares2X2Icon, FireIcon, SparklesIcon, ListBulletIcon } from '@heroicons/vue/24/outline'
import PizzaIcon from '../ui/PizzaIcon.vue'
import DrinkIcon from '../ui/DrinkIcon.vue'
import BurgerIcon from '../ui/BurgerIcon.vue'
defineProps({ categories: { type: Array, required: true }, modelValue: { type: [Number, String], default: 'all' } })
defineEmits(['update:modelValue'])
function categoryIcon(name) {
  if (/pizza/i.test(name)) return PizzaIcon
  if (/chicken|korean|spicy/i.test(name)) return FireIcon
  if (/drink|beverage/i.test(name)) return DrinkIcon
  if (/fast\s*food|burger|snack|fries/i.test(name)) return BurgerIcon
  if (/signature/i.test(name)) return SparklesIcon
  return ListBulletIcon
}
</script>
<template>
  <div class="customer-categories" :aria-label="$t('Menu categories')">
    <button :class="{ selected: modelValue === 'all' }" :aria-pressed="modelValue === 'all'" @click="$emit('update:modelValue', 'all')"><span><Squares2X2Icon /></span>{{ $t("All") }}</button>
    <button v-for="category in categories" :key="category.id" :class="{ selected: modelValue === category.id }" :aria-pressed="modelValue === category.id" @click="$emit('update:modelValue', category.id)"><span><component :is="categoryIcon(category.name)" /></span>{{ category.name }}</button>
  </div>
</template>
