const key = 'fantasia_table_orders'
function read() {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
export function rememberTableOrder(table, token, orderNumber) {
  try {
    const orders = read()
    for (const id of [token, table?.qr_token, table?.table_number].filter(Boolean)) orders[id] = orderNumber
    localStorage.setItem(key, JSON.stringify(orders))
    localStorage.setItem('fantasia_last_order', orderNumber)
  } catch { /* Storage is optional; successful orders still proceed to tracking. */ }
}
export function tableOrder(table, token) {
  const orders = read()
  return orders[token] || orders[table?.qr_token] || orders[table?.table_number] || null
}
