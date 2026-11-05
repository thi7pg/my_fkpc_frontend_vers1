const key = 'fantasia_table_orders'
function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  } catch {
    return {}
  }
}
export function rememberTableOrder(table, token, orderNumber, makeLatest = true) {
  try {
    const orders = read()
    for (const id of [token, table?.qr_token, table?.table_number].filter(Boolean))
      orders[id] = orderNumber
    localStorage.setItem(key, JSON.stringify(orders))
    if (makeLatest) localStorage.setItem('fantasia_last_order', orderNumber)
  } catch {
    /* Storage is optional; successful orders still proceed to tracking. */
  }
}
export function tableOrder(table, token) {
  const orders = read()
  return orders[token] || orders[table?.qr_token] || orders[table?.table_number] || null
}

export function forgetSessionOrders(orderNumbers, currentToken) {
  const completed = new Set(orderNumbers)
  try {
    const orders = read()
    const currentVisit = completed.has(orders[currentToken])
    for (const [id, orderNumber] of Object.entries(orders)) {
      if (completed.has(orderNumber)) delete orders[id]
    }
    localStorage.setItem(key, JSON.stringify(orders))
    if (completed.has(localStorage.getItem('fantasia_last_order')))
      localStorage.removeItem('fantasia_last_order')
    return currentVisit
  } catch {
    return false
  }
}
