<script setup>
import { t } from '../../i18n'
import { ref, onMounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { adminService } from '../../services/adminService'
import { toFormData } from '../../utils/formData'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import { useRestaurantStore } from '../../stores/restaurant'

const toast = useToast()
const restaurant = useRestaurantStore()
const loading = ref(true)
const saving = ref(false)
const logoFile = ref(null)
const currentLogo = ref(null)
const fieldErrors = ref({})
const saveError = ref('')
function fieldError(field) {
  const messages = fieldErrors.value[field]
  return Array.isArray(messages) ? messages.join(' ') : messages || ''
}
function clearError(field) {
  delete fieldErrors.value[field]
}
function timeInput(value) {
  // HTML time controls can return seconds; the API expects HH:mm.
  return value ? String(value).slice(0, 5) : ''
}

const form = ref({
  name: '',
  address: '',
  phone: '',
  email: '',
  currency: 'USD',
  tax_percentage: 0,
  service_charge_percentage: 0,
  opening_time: '',
  closing_time: '',
})

async function load() {
  loading.value = true
  try {
    const res = await adminService.getSettings()
    const s = res.data
    restaurant.setSettings(s)
    form.value = {
      name: s.name ?? '',
      address: s.address ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      currency: s.currency ?? 'USD',
      tax_percentage: s.tax_percentage ?? 0,
      service_charge_percentage: s.service_charge_percentage ?? 0,
      opening_time: timeInput(s.opening_time),
      closing_time: timeInput(s.closing_time),
    }
    currentLogo.value = s.logo
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onFileChange(event) {
  logoFile.value = event.target.files[0] ?? null
  clearError('logo')
}

async function save() {
  if (saving.value) return
  saving.value = true
  fieldErrors.value = {}
  saveError.value = ''
  try {
    const payload = toFormData({ ...form.value, opening_time: timeInput(form.value.opening_time), closing_time: timeInput(form.value.closing_time), logo: logoFile.value })
    await adminService.updateSettings(payload)
    toast.success(t("Settings saved"))
    await load()
    logoFile.value = null
  } catch (e) {
    fieldErrors.value = e.errors && typeof e.errors === 'object' ? e.errors : {}
    saveError.value = Object.keys(fieldErrors.value).length ? 'Please correct the highlighted fields below.' : e.message
    await nextTick()
    document.querySelector('[aria-invalid="true"]')?.focus()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Restaurant Settings") }}</h1>

    <div v-if="loading" class="flex flex-col gap-3">
      <SkeletonLoader variant="line" :count="6" />
    </div>

    <form v-else class="card flex flex-col gap-4 p-5 settings-form" @submit.prevent="save">
      <p v-if="saveError" role="alert" class="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-medium text-danger-600">{{ $t(saveError) }}</p>
      <div class="flex items-center gap-4">
        <div class="h-16 w-16 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          <img v-if="currentLogo" :src="currentLogo" :alt="$t('Logo')" class="h-full w-full object-cover" />
        </div>
        <div class="flex-1">
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-logo">{{ $t("Logo") }}</label>
          <input
            type="file" id="settings-logo" :aria-invalid="!!fieldError('logo')" :aria-describedby="fieldError('logo') ? 'settings-logo-error' : undefined" @input="clearError('logo')"
            accept="image/*"
            class="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 dark:text-slate-300 dark:file:bg-primary-500/10 dark:file:text-primary-400"
            @change="onFileChange"
          />
          <p v-if="fieldError('logo')" id="settings-logo-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('logo') }}</p>
        </div>
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-name">{{ $t("Restaurant Name") }}</label>
        <input v-model="form.name" id="settings-name" :aria-invalid="!!fieldError('name')" :aria-describedby="fieldError('name') ? 'settings-name-error' : undefined" @input="clearError('name')" type="text" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('name')" id="settings-name-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('name') }}</p>
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-address">{{ $t("Address") }}</label>
        <input v-model="form.address" id="settings-address" :aria-invalid="!!fieldError('address')" :aria-describedby="fieldError('address') ? 'settings-address-error' : undefined" @input="clearError('address')" type="text" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('address')" id="settings-address-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('address') }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-phone">{{ $t("Phone") }}</label>
          <input v-model="form.phone" id="settings-phone" :aria-invalid="!!fieldError('phone')" :aria-describedby="fieldError('phone') ? 'settings-phone-error' : undefined" @input="clearError('phone')" type="tel" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('phone')" id="settings-phone-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('phone') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-email">{{ $t("Email") }}</label>
          <input v-model="form.email" id="settings-email" :aria-invalid="!!fieldError('email')" :aria-describedby="fieldError('email') ? 'settings-email-error' : undefined" @input="clearError('email')" type="email" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('email')" id="settings-email-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('email') }}</p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-currency">{{ $t("Currency") }}</label>
          <input v-model="form.currency" id="settings-currency" :aria-invalid="!!fieldError('currency')" :aria-describedby="fieldError('currency') ? 'settings-currency-error' : undefined" @input="clearError('currency')" type="text" maxlength="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm uppercase focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('currency')" id="settings-currency-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('currency') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-tax_percentage">{{ $t("Tax %") }}</label>
          <input v-model.number="form.tax_percentage" id="settings-tax_percentage" :aria-invalid="!!fieldError('tax_percentage')" :aria-describedby="fieldError('tax_percentage') ? 'settings-tax_percentage-error' : undefined" @input="clearError('tax_percentage')" type="number" min="0" max="100" step="0.1" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('tax_percentage')" id="settings-tax_percentage-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('tax_percentage') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-service_charge_percentage">{{ $t("Service %") }}</label>
          <input v-model.number="form.service_charge_percentage" id="settings-service_charge_percentage" :aria-invalid="!!fieldError('service_charge_percentage')" :aria-describedby="fieldError('service_charge_percentage') ? 'settings-service_charge_percentage-error' : undefined" @input="clearError('service_charge_percentage')" type="number" min="0" max="100" step="0.1" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('service_charge_percentage')" id="settings-service_charge_percentage-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('service_charge_percentage') }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-opening_time">{{ $t("Opening Time") }}</label>
          <input v-model="form.opening_time" id="settings-opening_time" :aria-invalid="!!fieldError('opening_time')" :aria-describedby="fieldError('opening_time') ? 'settings-opening_time-error' : undefined" @input="clearError('opening_time')" type="time" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('opening_time')" id="settings-opening_time-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('opening_time') }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200" for="settings-closing_time">{{ $t("Closing Time") }}</label>
          <input v-model="form.closing_time" id="settings-closing_time" :aria-invalid="!!fieldError('closing_time')" :aria-describedby="fieldError('closing_time') ? 'settings-closing_time-error' : undefined" @input="clearError('closing_time')" type="time" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          <p v-if="fieldError('closing_time')" id="settings-closing_time-error" class="mt-1 text-xs font-medium text-danger-600">{{ fieldError('closing_time') }}</p>
        </div>
      </div>

      <button
        type="submit"
        :disabled="saving"
        class="mt-2 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
      >
        {{ saving ? $t("Saving…") : $t("Save Settings") }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.settings-form [aria-invalid="true"] { border-color: #CE0233; background-color: #fff5f7; }
</style>
