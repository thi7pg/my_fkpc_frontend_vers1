<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { LanguageIcon, GlobeAltIcon, ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/outline'
import { languages, locale, setLocale } from '../../languages'
defineProps({ light: Boolean })
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const selected = computed(() => languages.find((language) => language.code === locale.value))
function close(event) {
  if (!root.value?.contains(event.target)) open.value = false
}
function choose(code) {
  setLocale(code)
  open.value = false
  trigger.value.focus()
}
function navigate(event) {
  const options = [...root.value.querySelectorAll('[role="menuitemradio"]')]
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    trigger.value.focus()
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const current = options.indexOf(document.activeElement)
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
    options[index]?.focus()
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', close)
  document.addEventListener('focusin', close)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', close)
  document.removeEventListener('focusin', close)
})
</script>
<template>
  <div ref="root" class="language-selector" @keydown="navigate">
    <button
      ref="trigger"
      class="language-trigger"
      :class="{
        'min-h-9! gap-1! border-white/50! bg-transparent! px-2! text-white! shadow-none!': light,
      }"
      aria-label="Language"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
      @keydown.down.prevent="open = true"
    >
      <span class="language-icon" :class="{ 'h-6! w-6! bg-transparent! text-white!': light }"
        ><component
          :is="light ? GlobeAltIcon : LanguageIcon"
          aria-hidden="true"
          :class="{ 'h-6! w-6!': light }"
      /></span>
      <span :lang="locale">{{ selected.label }}</span>
      <ChevronDownIcon
        v-if="!light"
        class="language-chevron"
        :class="{ expanded: open }"
        aria-hidden="true"
      />
    </button>
    <div v-if="open" class="language-menu" role="menu" aria-label="Language">
      <button
        v-for="language in languages"
        :key="language.code"
        role="menuitemradio"
        :aria-checked="locale === language.code"
        :class="{ selected: locale === language.code }"
        @click="choose(language.code)"
      >
        <span class="language-code" aria-hidden="true">{{ language.code.toUpperCase() }}</span>
        <span :lang="language.code">{{ language.label }}</span>
        <CheckIcon v-if="locale === language.code" class="language-check" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
<style scoped>
.language-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px 0 7px;
  border: 1px solid #e9e3e5;
  border-radius: 999px;
  color: #51494e;
  background: #fff;
  box-shadow: 0 2px 6px #33232b05;
  flex-shrink: 0;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.language-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff1f4;
  color: #ce0233;
  pointer-events: none;
}
.language-icon svg {
  width: 16px;
  height: 16px;
}
.language-trigger > span[lang] {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  max-width: 100px;
}
.language-chevron {
  margin-left: 2px;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: #91868c;
  pointer-events: none;
}
.language-trigger:hover {
  border-color: #e4b8c3;
}
.language-trigger:focus-visible {
  outline: 2px solid #ce0233;
  outline-offset: 3px;
  border-color: #ce0233;
}
@media (prefers-reduced-motion: reduce) {
  .language-selector {
    transition: none;
  }
}
.language-selector {
  position: relative;
  flex-shrink: 0;
}
.language-trigger {
  cursor: pointer;
}
.language-chevron.expanded {
  transform: rotate(180deg);
}
.language-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 60;
  width: 210px;
  max-width: calc(100vw - 24px);
  padding: 6px;
  border: 1px solid #eee7ea;
  border-radius: 16px;
  background: white;
  box-shadow: 0 12px 36px #33232b20;
}
.language-menu button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 10px;
  border-radius: 10px;
  text-align: left;
  color: #51494e;
  font-size: 14px;
  cursor: pointer;
}
.language-menu button:hover,
.language-menu button:focus-visible {
  background: #f8f4f6;
  outline: 2px solid #e4b8c3;
  outline-offset: -2px;
}
.language-menu button.selected {
  background: #fff1f4;
  color: #ce0233;
  font-weight: 600;
}
.language-code {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}
.language-check {
  margin-left: auto;
  width: 18px;
  height: 18px;
}
:global(.dark) .language-trigger,
:global(.dark) .language-menu {
  background: #0f172a;
  border-color: #334155;
  color: #e2e8f0;
}
:global(.dark) .language-menu button {
  color: #e2e8f0;
}
:global(.dark) .language-menu button:hover,
:global(.dark) .language-menu button:focus-visible {
  background: #1e293b;
}
:global(.dark) .language-menu button.selected {
  background: #4c1427;
  color: #fda4af;
}
</style>
