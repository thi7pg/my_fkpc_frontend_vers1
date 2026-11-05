import { t } from '../languages'

export async function printTableQr(tableNumber, imageUrl) {
  const frame = document.createElement('iframe')
  frame.title = t('Print QR')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;bottom:0;left:0'
  document.body.append(frame)
  try {
    const doc = frame.contentDocument
    doc.title = `${t('Table')} ${tableNumber}`
    doc.documentElement.lang = document.documentElement.lang
    const style = doc.createElement('style')
    style.textContent = `
      @page { margin: 15mm; }
      body { margin: 0; background: white; color: black; font-family: Arial, sans-serif; text-align: center; }
      main { padding: 12mm; break-inside: avoid; }
      h1 { font-size: 32pt; margin: 0 0 10mm; }
      img { display: block; width: 65mm; height: 65mm; object-fit: contain; margin: auto; }
      p { font-size: 16pt; margin-top: 10mm; }
    `
    doc.head.append(style)
    const main = doc.createElement('main')
    const heading = doc.createElement('h1')
    heading.textContent = `${t('Table')} ${tableNumber}`
    const image = doc.createElement('img')
    image.alt = t('QR code')
    const instruction = doc.createElement('p')
    instruction.textContent = t('Scan to order')
    main.append(heading, image, instruction)
    doc.body.append(main)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t('Unable to load QR code'))), 15000)
      image.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      image.onerror = () => {
        clearTimeout(timeout)
        reject(new Error(t('Unable to load QR code')))
      }
      image.src = imageUrl
    })
    await doc.fonts.ready
    frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true })
    frame.contentWindow.focus()
    frame.contentWindow.print()
  } catch (error) {
    frame.remove()
    throw error
  }
}
