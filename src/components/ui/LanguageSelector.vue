<script setup>
import { LanguageIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { languages, locale, setLocale } from '../../i18n'
</script>
<template>
  <label class="language-selector">
    <span class="language-icon"><LanguageIcon aria-hidden="true" /></span>
    <select :value="locale" aria-label="Language / ភាសា / 언어" @change="setLocale($event.target.value)">
      <option v-for="language in languages" :key="language.code" :value="language.code" :lang="language.code">{{ language.label }}</option>
    </select>
    <ChevronDownIcon class="language-chevron" aria-hidden="true" />
  </label>
</template>
<style scoped>
.language-selector {
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
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.language-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff1f4;
  color: #CE0233;
  pointer-events: none;
}
.language-icon svg { width: 16px; height: 16px; }
.language-selector select {
  appearance: none;
  border: 0;
  outline: none;
  padding: 0 20px 0 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: inherit;
  background: transparent;
  max-width: 100px;
  min-height: 44px;
  cursor: pointer;
}
.language-chevron {
  position: absolute;
  right: 12px;
  width: 12px;
  height: 12px;
  color: #91868c;
  pointer-events: none;
}
.language-selector:hover { border-color: #e4b8c3; }
.language-selector:focus-within {
  outline: 2px solid #CE0233;
  outline-offset: 3px;
  border-color: #CE0233;
}
@media (prefers-reduced-motion: reduce) {
  .language-selector { transition: none; }
}
</style>
