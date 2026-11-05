<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { ref, watch, nextTick, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
})
const emit = defineEmits(['update:modelValue'])
const panel = ref(null)
let previousFocus
let previousOverflow

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = Array.from(
    panel.value?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
    ) || [],
  )
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first) {
    event.preventDefault()
    panel.value?.focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || !panel.value.contains(document.activeElement))
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !panel.value.contains(document.activeElement))
  ) {
    event.preventDefault()
    first.focus()
  }
}

function restorePage() {
  document.removeEventListener('keydown', handleKeydown)
  if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
  previousOverflow = undefined
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      restorePage()
      return
    }
    previousFocus = document.activeElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    if (!props.modelValue) return
    panel.value?.querySelector('button')?.focus()
    document.addEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)
onUnmounted(restorePage)

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="animate-fade-in"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="close" />
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="$t(title || 'Confirm')"
          tabindex="-1"
          class="relative flex max-h-[calc(100dvh-2rem)] w-full animate-slide-up flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
          :class="sizes[size]"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800"
          >
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {{ $t(title) }}
            </h3>
            <button
              :aria-label="$t('Close')"
              class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              @click="close"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="min-h-0 overflow-y-auto p-6"><slot /></div>
          <div
            v-if="$slots.footer"
            class="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
