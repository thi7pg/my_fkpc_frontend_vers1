<script setup>
import { t } from '../../i18n'
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { PlusIcon, TagIcon } from '@heroicons/vue/24/outline'
import { adminService } from '../../services/adminService'
import { useCategoriesStore } from '../../stores/categories'
import { toFormData } from '../../utils/formData'
import CategoryCard from '../../components/staff/CategoryCard.vue'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()
const store = useCategoriesStore()

const modalOpen = ref(false)
const editing = ref(null)
const form = ref({ name: '', is_active: true, sort_order: 0, image: null })
const saving = ref(false)

const confirmOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

onMounted(() => store.fetchCategories())

function openCreate() {
  editing.value = null
  form.value = { name: '', is_active: true, sort_order: 0, image: null }
  modalOpen.value = true
}

function openEdit(category) {
  editing.value = category
  form.value = { name: category.name, is_active: category.is_active, sort_order: category.sort_order ?? 0, image: null }
  modalOpen.value = true
}

function onFileChange(event) {
  form.value.image = event.target.files[0] ?? null
}

async function save() {
  saving.value = true
  try {
    const payload = toFormData(form.value)
    if (editing.value) {
      await adminService.categories.update(editing.value.id, payload)
      toast.success(t("Category updated"))
    } else {
      await adminService.categories.create(payload)
      toast.success(t("Category created"))
    }
    modalOpen.value = false
    await store.fetchCategories()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    saving.value = false
  }
}

function confirmDelete(category) {
  deleteTarget.value = category
  confirmOpen.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await adminService.categories.remove(deleteTarget.value.id)
    toast.success(t("Category deleted"))
    confirmOpen.value = false
    await store.fetchCategories()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Categories") }}</h1>
      <button
        class="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
        @click="openCreate"
      >
        <PlusIcon class="h-4 w-4" /> {{ $t("Add Category") }} </button>
    </div>

    <div v-if="store.loading" class="flex flex-col gap-3">
      <SkeletonLoader variant="line" :count="5" />
    </div>
    <EmptyState v-else-if="store.categories.length === 0" :icon="TagIcon" :title="$t('No categories yet')" />
    <div v-else class="flex flex-col gap-3">
      <CategoryCard v-for="category in store.categories" :key="category.id" :category="category" @edit="openEdit" @delete="confirmDelete" />
    </div>

    <Modal v-model="modalOpen" :title="editing ? $t('Edit Category') : $t('Add Category')" size="sm">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Name") }}</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="Beverages"
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Image") }}</label>
          <input
            type="file"
            accept="image/*"
            class="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 dark:text-slate-300 dark:file:bg-primary-500/10 dark:file:text-primary-400"
            @change="onFileChange"
          />
        </div>
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Active") }}</label>
          <input v-model="form.is_active" type="checkbox" class="h-5 w-5 rounded text-primary-600 focus:ring-primary-500" />
        </div>
        <button
          type="submit"
          :disabled="saving"
          class="mt-2 w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {{ saving ? $t("Saving…") : $t("Save Category") }}
        </button>
      </form>
    </Modal>

    <ConfirmDialog
      v-model="confirmOpen"
      :title="$t('Delete category?')"
      :message="$t('This will permanently remove {name}.', { name: deleteTarget?.name })"
      danger
      :loading="deleting"
      @confirm="doDelete"
    />
  </div>
</template>
