<script setup>
import { ref, nextTick, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  QrCodeIcon,
  ArrowRightIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
  HashtagIcon,
} from '@heroicons/vue/24/outline'
import jsQR from 'jsqr'
import { t } from '../../languages'
const router = useRouter()
const route = useRoute()
const scanInput = ref(null)
const scanError = ref('')
const scanHint = ref('')
const readingPhoto = ref(false)
const cameraOpen = ref(false)
const video = ref(null)
const orderNumber = ref('')
const tableEntryOpen = ref(false)
const tableNumber = ref('')
const tableInput = ref(null)
async function toggleTableEntry() {
  tableEntryOpen.value = !tableEntryOpen.value
  if (tableEntryOpen.value) {
    stopScan()
    await nextTick()
    tableInput.value?.focus()
  }
}
let stream = null
let frameTimer = null
let scanVersion = 0
function stopScan() {
  scanVersion++
  clearTimeout(frameTimer)
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  cameraOpen.value = false
}
onUnmounted(stopScan)
function openMenu(value) {
  let token = value.trim()
  if (!token) return
  try {
    const url = new URL(token, window.location.origin)
    const match = url.pathname.match(/^\/order\/menu\/([^/]+)\/?$/)
    if (match) token = decodeURIComponent(match[1])
    else if (/^https?:/i.test(token)) throw new Error('Invalid menu link')
  } catch {
    if (/^https?:/i.test(token)) {
      scanError.value = t('This QR code is not a table menu.')
      return false
    }
  }
  stopScan()
  router.push({ name: 'menu', params: { qrToken: token } })
  return true
}
function decodeImage(source, width, height, maxSize = 960, crop = null) {
  const region = crop || { x: 0, y: 0, width, height }
  const scale = Math.min(1, maxSize / Math.max(region.width, region.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(region.width * scale))
  canvas.height = Math.max(1, Math.round(region.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(pixels.data, pixels.width, pixels.height)?.data
}
async function startScan() {
  stopScan()
  scanError.value = ''
  scanHint.value = ''
  tableEntryOpen.value = false
  // Mobile file capture can open the native camera even on a LAN HTTP page.
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    scanHint.value = t('Take a clear photo of the QR code, then tap Use Photo to open the menu.')
    scanInput.value?.click()
    return
  }
  cameraOpen.value = true
  const version = scanVersion
  try {
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })
    if (version !== scanVersion) {
      nextStream.getTracks().forEach((track) => track.stop())
      return
    }
    stream = nextStream
    await nextTick()
    video.value.srcObject = stream
    await video.value.play()
    function scanFrame() {
      if (version !== scanVersion || !cameraOpen.value) return
      try {
        if (video.value?.readyState >= 2) {
          const result = decodeImage(video.value, video.value.videoWidth, video.value.videoHeight)
          if (result && openMenu(result)) return
        }
      } catch {
        /* Retry while the camera becomes ready. */
      }
      frameTimer = setTimeout(scanFrame, 200)
    }
    scanFrame()
  } catch (error) {
    if (version !== scanVersion) return
    stopScan()
    scanError.value = t(
      error.name === 'NotAllowedError'
        ? 'Allow camera access to scan your table.'
        : 'Camera unavailable. Try taking a QR photo.',
    )
  }
}
async function readQrImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  readingPhoto.value = true
  scanError.value = ''
  scanHint.value = ''
  const objectUrl = URL.createObjectURL(file)
  try {
    // HTMLImageElement also works on iPhones where createImageBitmap cannot decode a camera photo.
    const image = await new Promise((resolve, reject) => {
      const photo = new Image()
      photo.onload = () => resolve(photo)
      photo.onerror = () => reject(new Error('Photo unreadable'))
      photo.src = objectUrl
    })
    const width = image.naturalWidth
    const height = image.naturalHeight
    let result
    // A QR photographed from a distance loses its small squares when the whole photo is shrunk.
    for (const size of [960, 1920]) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      result = decodeImage(image, width, height, size)
      if (result) break
    }
    if (!result) {
      const edge = Math.min(width, height) * 0.65
      for (const y of [0.5, 0.25, 0.75]) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        result = decodeImage(image, width, height, 1600, {
          x: (width - edge) / 2,
          y: Math.max(0, Math.min(height - edge, height * y - edge / 2)),
          width: edge,
          height: edge,
        })
        if (result) break
      }
    }
    if (!result) throw new Error('No QR')
    openMenu(result)
  } catch {
    scanError.value = t(
      'QR code not detected. Move closer and take a sharp photo, or enter your table number.',
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
    readingPhoto.value = false
    event.target.value = ''
  }
}
function trackOrder() {
  if (orderNumber.value.trim())
    router.push({ name: 'order-tracking', params: { orderNumber: orderNumber.value.trim() } })
}
</script>
<template>
  <div class="landing-page">
    <section class="home-menu-card home-poster">
      <div class="home-menu-intro">
        <div>
          <p>{{ $t('Korean Pizza & Chicken') }}</p>
          <h1>{{ $t('Our menu') }}</h1>
        </div>
        <img src="/food-illustration.svg" alt="" />
      </div>
      <button class="customer-primary" :disabled="readingPhoto" @click="startScan">
        <QrCodeIcon />{{ readingPhoto ? $t('Reading QR photo…') : $t('Scan table menu')
        }}<ArrowRightIcon />
      </button>
      <button
        class="home-table-option"
        type="button"
        :aria-expanded="tableEntryOpen"
        aria-controls="table-number-form"
        @click="toggleTableEntry"
      >
        <HashtagIcon />{{ $t('Enter table number') }}<ArrowRightIcon />
      </button>
      <form
        v-if="tableEntryOpen"
        id="table-number-form"
        class="home-entry-form home-table-form"
        @submit.prevent="openMenu(tableNumber)"
      >
        <label for="table-number">{{ $t('Table number') }}</label>
        <div>
          <input
            id="table-number"
            ref="tableInput"
            v-model="tableNumber"
            type="text"
            inputmode="numeric"
            maxlength="50"
            :placeholder="$t('Enter table number')"
            required
          /><button class="customer-primary" type="submit">{{ $t('Confirm table') }}</button>
        </div>
      </form>
      <input
        ref="scanInput"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        :aria-label="$t('Scan table menu')"
        @change="readQrImage"
      />
      <p v-if="scanError" class="home-scan-error" role="alert">{{ scanError }}</p>
      <p v-if="scanHint || readingPhoto" class="home-scan-error" role="status">
        {{ readingPhoto ? $t('Reading QR photo…') : scanHint }}
      </p>
    </section>
    <div
      v-if="cameraOpen"
      class="qr-camera"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('Scan table menu')"
      @keydown.esc="stopScan"
    >
      <button class="qr-camera-close" :aria-label="$t('Close')" autofocus @click="stopScan">
        <XMarkIcon />
      </button>
      <video ref="video" autoplay muted playsinline />
      <div class="qr-camera-guide" aria-hidden="true" />
      <p>{{ $t('Point your camera at the table QR code.') }}</p>
    </div>
    <section v-if="route.query.orders" class="home-tools">
      <details v-if="route.query.orders" class="home-track" open>
        <summary>
          <ClipboardDocumentListIcon /><span>{{ $t('Track your order') }}</span
          ><ArrowRightIcon />
        </summary>
        <form class="home-entry-form" @submit.prevent="trackOrder">
          <input
            v-model="orderNumber"
            :aria-label="$t('Order number')"
            :placeholder="$t('Order number')"
            required
          /><button class="customer-primary" type="submit">{{ $t('Track') }}</button>
        </form>
      </details>
    </section>
  </div>
</template>
