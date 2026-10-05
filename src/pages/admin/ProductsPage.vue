<script setup>
import { t } from '../../i18n'
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { PlusIcon, PencilIcon, TrashIcon, CakeIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { adminService } from '../../services/adminService'
import { useProductsStore } from '../../stores/products'
import { useCategoriesStore } from '../../stores/categories'
import { toFormData } from '../../utils/formData'
import { formatCurrency } from '../../utils/format'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()
const productsStore = useProductsStore()
const categoriesStore = useCategoriesStore()

const search = ref('')
const categoryFilter = ref('')

const modalOpen = ref(false)
const editing = ref(null)
const form = ref({ category_id: '', name: '', description: '', price: '', available: true, preparation_time: 15, image: null })
const saving = ref(false)

const confirmOpen = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

function loadProducts() {
  return productsStore.fetchProducts({
    search: search.value || undefined,
    category_id: categoryFilter.value || undefined,
  })
}

onMounted(async () => {
  await Promise.all([categoriesStore.fetchCategories(), loadProducts()])
})

let searchTimeout
watch([search, categoryFilter], () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadProducts, 300)
})

function openCreate() {
  editing.value = null
  form.value = { category_id: categoriesStore.categories[0]?.id ?? '', name: '', description: '', price: '', available: true, preparation_time: 15, image: null }
  modalOpen.value = true
}

function openEdit(product) {
  editing.value = product
  form.value = {
    category_id: product.category_id,
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    available: product.available,
    preparation_time: product.preparation_time ?? 15,
    image: null,
  }
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
      await adminService.products.update(editing.value.id, payload)
      toast.success(t("Product updated"))
    } else {
      await adminService.products.create(payload)
      toast.success(t("Product created"))
    }
    modalOpen.value = false
    await loadProducts()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    saving.value = false
  }
}

function confirmDelete(product) {
  deleteTarget.value = product
  confirmOpen.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await adminService.products.remove(deleteTarget.value.id)
    toast.success(t("Product deleted"))
    confirmOpen.value = false
    await loadProducts()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Products") }}</h1>
      <button
        class="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
        @click="openCreate">
        <PlusIcon class="h-4 w-4" /> {{ $t("Add Product") }}
      </button>
    </div>

    <div class="flex flex-wrap gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
        <input v-model="search" type="search" :placeholder="$t('Search products…')"
          class="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
      </div>
      <select v-model="categoryFilter"
        class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900">
        <option value="">{{ $t("All Categories") }}</option>
        <option v-for="c in categoriesStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>

    <div v-if="productsStore.loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <SkeletonLoader variant="card" :count="8" />
    </div>
    <EmptyState v-else-if="productsStore.products.length === 0" :icon="CakeIcon"
      :title="$t('No products found')" />
    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="product in productsStore.products" :key="product.id" class="card flex flex-col overflow-hidden">
        <div class="aspect-square w-full bg-slate-100 dark:bg-slate-800">
          <img v-if="product.image" :src="product.image" :alt="product.name" class="h-full w-full object-cover" />
        </div>
        <div class="flex flex-1 flex-col gap-1 p-3">
          <p class="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ product.name }}</p>
          <p class="text-xs text-slate-400">{{ product.category?.name }}</p>
          <div class="mt-auto flex items-center justify-between pt-2">
            <span class="text-sm font-bold text-primary-600 dark:text-primary-400">{{ formatCurrency(product.price)
              }}</span>
            <span class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="product.available ? 'bg-success-50 text-success-600 dark:bg-success-500/10' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'">
              {{ product.available ? $t("Available") : $t("Hidden") }}
            </span>
          </div>
          <div class="mt-2 flex gap-1.5">
            <button
              class="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="openEdit(product)">
              <PencilIcon class="h-3.5 w-3.5" /> {{ $t("Edit") }}
            </button>
            <button
              class="flex items-center justify-center rounded-lg border border-slate-200 px-2 text-danger-600 hover:bg-danger-50 dark:border-slate-700 dark:hover:bg-danger-500/10"
              @click="confirmDelete(product)">
              <TrashIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <Modal v-model="modalOpen" :title="editing ? $t('Edit Product') : $t('Add Product')">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Category")
            }}</label>
          <select v-model="form.category_id" required
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900">
            <option v-for="c in categoriesStore.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Name") }}</label>
          <input v-model="form.name" type="text" required
            class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Description")
            }}</label>
          <textarea v-model="form.description" rows="2"
            class="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Price") }}</label>
            <input v-model.number="form.price" type="number" min="0" step="0.01" required
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Prep Time (min)")
              }}</label>
            <input v-model.number="form.preparation_time" type="number" min="1"
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Image") }}</label>
          <input type="file" accept="image/*"
            class="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 dark:text-slate-300 dark:file:bg-primary-500/10 dark:file:text-primary-400"
            @change="onFileChange" />
        </div>
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Available") }}</label>
          <input v-model="form.available" type="checkbox"
            class="h-5 w-5 rounded text-primary-600 focus:ring-primary-500" />
        </div>
        <button type="submit" :disabled="saving"
          class="mt-2 w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
          {{ saving ? $t("Saving…") : $t("Save Product") }}
        </button>
      </form>
    </Modal>

    <ConfirmDialog v-model="confirmOpen" :title="$t('Delete product ?')"
      :message="$t('This will permanently remove {name}.', { name: deleteTarget?.name })" danger :loading="deleting"
      @confirm="doDelete" />
  </div>
</template>
