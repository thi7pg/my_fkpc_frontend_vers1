<script setup>
import { ref, nextTick, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { QrCodeIcon, ArrowRightIcon, ClipboardDocumentListIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import jsQR from 'jsqr'
import { t } from '../../i18n'
const router = useRouter()
const route = useRoute()
const scanInput = ref(null)
const scanError = ref('')
const cameraOpen = ref(false)
const video = ref(null)
const orderNumber = ref('')
let stream = null
let frameTimer = null
let scanVersion = 0
function stopScan() {
  scanVersion++
  clearTimeout(frameTimer)
  stream?.getTracks().forEach(track => track.stop())
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
function decodeImage(source, width, height) {
  const scale = Math.min(1, 960 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(pixels.data, pixels.width, pixels.height)?.data
}
async function startScan() {
  stopScan()
  scanError.value = ''
  // Mobile file capture can open the native camera even on a LAN HTTP page.
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    scanInput.value?.click()
    return
  }
  cameraOpen.value = true
  const version = scanVersion
  try {
    const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    if (version !== scanVersion) {
      nextStream.getTracks().forEach(track => track.stop())
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
      } catch { /* Retry while the camera becomes ready. */ }
      frameTimer = setTimeout(scanFrame, 200)
    }
    scanFrame()
  } catch (error) {
    if (version !== scanVersion) return
    stopScan()
    scanError.value = t(error.name === 'NotAllowedError' ? 'Allow camera access to scan your table.' : 'Camera unavailable. Try taking a QR photo.')
  }
}
async function readQrImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const result = decodeImage(bitmap, bitmap.width, bitmap.height)
    if (!result) throw new Error('No QR')
    openMenu(result)
  } catch {
    scanError.value = t('QR code not detected. Please scan again.')
  } finally {
    bitmap?.close()
    event.target.value = ''
  }
}
function trackOrder() {
  if (orderNumber.value.trim()) router.push({ name: 'order-tracking', params: { orderNumber: orderNumber.value.trim() } })
}
</script>
<template>
  <div class="landing-page">
    <section class="home-menu-card home-poster">
      <div class="home-menu-intro"><div><p>{{ $t('Korean Pizza & Chicken') }}</p><h1>{{ $t('Our menu') }}</h1></div><img src="/food-illustration.svg" alt="" /></div>
      <button class="customer-primary" @click="startScan"><QrCodeIcon />{{ $t('Scan table menu') }}<ArrowRightIcon /></button>
      <input ref="scanInput" type="file" accept="image/*" capture="environment" hidden :aria-label="$t('Scan table menu')" @change="readQrImage" />
      <p v-if="scanError" class="home-scan-error" role="alert">{{ scanError }}</p>
    </section>
    <div v-if="cameraOpen" class="qr-camera" role="dialog" aria-modal="true" :aria-label="$t('Scan table menu')" @keydown.esc="stopScan">
      <button class="qr-camera-close" :aria-label="$t('Close')" autofocus @click="stopScan"><XMarkIcon /></button>
      <video ref="video" autoplay muted playsinline />
      <div class="qr-camera-guide" aria-hidden="true" />
      <p>{{ $t('Point your camera at the table QR code.') }}</p>
    </div>
    <section v-if="route.query.orders" class="home-tools">
      <details v-if="route.query.orders" class="home-track" open>
        <summary><ClipboardDocumentListIcon /><span>{{ $t('Track your order') }}</span><ArrowRightIcon /></summary>
        <form class="home-entry-form" @submit.prevent="trackOrder"><input v-model="orderNumber" :aria-label="$t('Order number')" :placeholder="$t('Order number')" required /><button class="customer-primary" type="submit">{{ $t('Track') }}</button></form>
      </details>
    </section>
  </div>
</template>
