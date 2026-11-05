// A6 portrait (105 × 148 mm), approximately 300 pixels per inch.
export async function createReceiptImage({ order, restaurant, t, money, date }) {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1240
  canvas.height = 1748
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const width = 520
  let height = (width * canvas.height) / canvas.width
  const rows = []
  let y = 48
  function text(value, size = 14, bold = false, align = 'left', x = 32) {
    ctx.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`
    const lines = []
    let line = ''
    for (const character of String(value ?? '')) {
      if (
        character === '\n' ||
        ctx.measureText(line + character).width > (align === 'center' ? 456 : 330)
      ) {
        lines.push(line)
        line = character === '\n' ? '' : character
      } else line += character
    }
    lines.push(line)
    for (const line of lines) {
      rows.push({ text: line, x, y, size, bold, align })
      y += size * 1.65
    }
  }
  function divider() {
    y += 10
    rows.push({ line: true, y })
    y += 24
  }
  text(restaurant?.name || 'FKPC', 24, true, 'center', width / 2)
  if (restaurant?.address) text(restaurant.address, 12, false, 'center', width / 2)
  if (restaurant?.phone) text(restaurant.phone, 12, false, 'center', width / 2)
  text(t('Receipt'), 18, true, 'center', width / 2)
  divider()
  text(`#${order.order_number}`, 16, true)
  const tableNumber = typeof order.table === 'object' ? order.table?.table_number : order.table
  text(`${t('Table')} ${tableNumber ?? '—'}`)
  text(date(order.created_at), 12)
  if (order.orders?.length) {
    text(`${t('Orders')}: ${order.orders.map((entry) => '#' + entry.order_number).join(', ')}`, 11)
  }
  if (order.payment?.status) {
    const paid = order.payment.status === 'paid'
    text(t(paid ? 'Paid' : 'Payment pending'), 13, true)
    if (order.payment.method) {
      const methods = {
        cash: 'Cash',
        bank: 'Bank transfer',
        acleda: 'ACLEDA (test)',
        acleda_demo: 'ACLEDA (test)',
      }
      text(
        `${t('Payment method')}: ${t(methods[order.payment.method] || order.payment.method)}`,
        12,
      )
    }
  }
  divider()
  const headingY = y
  text(t('Items'), 12, true)
  rows.push({ text: t('Amount'), x: width - 32, y: headingY, size: 12, bold: true, align: 'right' })
  y += 8
  function itemRow(item) {
    const itemY = y
    text(`${item.quantity} × ${item.product_name}`)
    rows.push({ text: money(item.subtotal), x: width - 32, y: itemY, size: 14, align: 'right' })
    y += 8
  }
  if (order.tables?.some((table) => Array.isArray(table.items))) {
    for (const table of order.tables) {
      text(`${t('Table')} ${table.table} · #${table.order_number}`, 13, true)
      for (const item of table.items) itemRow(item)
      amountRow(`${t('Table')} ${table.table}`, table.total_amount)
      y += 12
    }
  } else {
    for (const item of order.items || []) {
      if (item.table) text(`${t('Table')} ${item.table}`, 11)
      itemRow(item)
    }
  }
  divider()
  function amountRow(label, amount) {
    const rowY = y
    text(t(label), 13)
    rows.push({ text: money(amount), x: width - 32, y: rowY, size: 13, align: 'right' })
  }
  if (order.subtotal != null) amountRow('Subtotal', order.subtotal)
  if (Number(order.tax_amount) > 0) amountRow('Tax', order.tax_amount)
  y += 8
  const totalY = y
  text(t('Total'), 20, true)
  rows.push({
    text: money(order.total_amount),
    x: width - 32,
    y: totalY,
    size: 20,
    bold: true,
    align: 'right',
  })
  divider()
  text(t('Thank you for your order!'), 13, false, 'center', width / 2)
  if (order.tables?.some((table) => Array.isArray(table.items))) {
    canvas.height = Math.max(canvas.height, Math.ceil(((y + 32) * canvas.width) / width))
    height = (width * canvas.height) / canvas.width
  }
  // Keep every item on the A6 sheet, even for a longer order.
  const fit = Math.min(1, (height - 32) / y)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(canvas.width / width, canvas.width / width)
  ctx.translate((width * (1 - fit)) / 2, 0)
  ctx.scale(fit, fit)
  ctx.textBaseline = 'top'
  for (const row of rows) {
    if (row.line) {
      ctx.strokeStyle = '#b8b8b8'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(32, row.y)
      ctx.lineTo(width - 32, row.y)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#171717'
      ctx.font = `${row.bold ? '700' : '400'} ${row.size}px Arial, sans-serif`
      ctx.textAlign = row.align || 'left'
      ctx.fillText(row.text, row.x, row.y)
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image export failed'))),
      'image/png',
    ),
  )
}
