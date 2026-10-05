<script setup>
import { t } from '../../i18n'
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { PlusIcon, TableCellsIcon } from '@heroicons/vue/24/outline'
import { adminService } from '../../services/adminService'
import TableCard from '../../components/staff/TableCard.vue'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()

const tables = ref([])
const loading = ref(true)

const modalOpen = ref(false)
const editing = ref(null)
const form = ref({ table_number: '', capacity: 2, status: 'available' })
const saving = ref(false)

const confirmOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await adminService.tables.list()
    tables.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editing.value = null
  form.value = { table_number: '', capacity: 2, status: 'available' }
  modalOpen.value = true
}

function openEdit(table) {
  editing.value = table
  form.value = { table_number: table.table_number, capacity: table.capacity, status: table.status }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await adminService.tables.update(editing.value.id, form.value)
      toast.success(t("Table updated"))
    } else {
      await adminService.tables.create(form.value)
      toast.success(t("Table created"))
    }
    modalOpen.value = false
    await load()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    saving.value = false
  }
}

function confirmDelete(table) {
  deleteTarget.value = table
  confirmOpen.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await adminService.tables.remove(deleteTarget.value.id)
    toast.success(t("Table deleted"))
    confirmOpen.value = false
    await load()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    deleting.value = false
  }
}

async function regenerateQr(table) {
  try {
    await adminService.tables.regenerateQr(table.id)
    toast.success(t("QR code regenerated"))
    await load()
  } catch (e) {
    toast.error(t(e.message))
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Tables") }}</h1>
      <button
        class="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
        @click="openCreate"
      >
        <PlusIcon class="h-4 w-4" /> {{ $t("Add Table") }} </button>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <SkeletonLoader variant="card" :count="8" />
    </div>
    <EmptyState v-else-if="tables.length === 0" :icon="TableCellsIcon" :title="$t('No tables yet')" :message="$t('Add your first table to generate a QR code.')" />
    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <TableCard
        v-for="table in tables"
        :key="table.id"
        :table="table"
        @edit="openEdit"
        @delete="confirmDelete"
        @regenerate-qr="regenerateQr"
      />
    </div>

    <Modal v-model="modalOpen" :title="editing ? $t('Edit Table') : $t('Add Table')" size="sm">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Table Number") }}</label>
          <input
            v-model="form.table_number"
            type="text"
            required
            placeholder="T01"
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Capacity") }}</label>
          <input
            v-model.number="form.capacity"
            type="number"
            min="1"
            required
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div v-if="editing">
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Status") }}</label>
          <select
            v-model="form.status"
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="available">{{ $t("Available") }}</option>
            <option value="occupied">{{ $t("Occupied") }}</option>
            <option value="reserved">{{ $t("Reserved") }}</option>
            <option value="inactive">{{ $t("Inactive") }}</option>
          </select>
        </div>
        <button
          type="submit"
          :disabled="saving"
          class="mt-2 w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {{ saving ? $t("Saving…") : $t("Save Table") }}
        </button>
      </form>
    </Modal>

    <ConfirmDialog
      v-model="confirmOpen"
      :title="$t('Delete table?')"
      :message="$t('This will permanently remove table {number}.', { number: deleteTarget?.table_number })"
      danger
      :loading="deleting"
      @confirm="doDelete"
    />
  </div>
</template>
