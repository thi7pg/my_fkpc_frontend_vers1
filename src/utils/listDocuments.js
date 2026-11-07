import { t } from '../languages'
import { orderService } from '../services/orderService'
import { cashierService } from '../services/cashierService'
import { formatDateTime } from './format'
import { STATUS_LABELS } from './orderStatus'
import { exportReportExcel, exportReportPdf } from './reportDocuments'

export async function exportList({ type, kind, params, search, currency }) {
  const list = type === 'orders' ? orderService.list : cashierService.invoices
  const records = []
  const seen = new Set()
  const changed = () => new Error('The list changed during export. Please try again.')
  let expectedTotal
  let last = 1
  for (let page = 1; page <= last; page++) {
    const response = await list({ ...params, page })
    if (!Array.isArray(response.data)) throw new Error('Unable to export report. Please try again.')
    const nextLast = Number(response.meta?.last_page ?? 1)
    if (!Number.isSafeInteger(nextLast) || nextLast < 1)
      throw new Error('Unable to export report. Please try again.')
    if (page > 1 && nextLast !== last) throw changed()
    last = nextLast
    const total = response.meta?.total
    if (page === 1) expectedTotal = total
    else if (total !== expectedTotal) throw changed()
    for (const record of response.data) {
      const id = String(record.id ?? record.order_number ?? '')
      // Reject a shifting page rather than silently dropping duplicates and
      // producing an incomplete export with a misleading total.
      if (!id || seen.has(id)) throw changed()
      seen.add(id)
      records.push(record)
    }
  }
  if (expectedTotal != null && records.length !== Number(expectedTotal)) throw changed()
  const query = search.trim().toLocaleLowerCase()
  const filtered = records.filter((record) => {
    const text =
      type === 'orders'
        ? [
            record.order_number,
            record.table?.table_number,
            ...(record.items || []).map((item) => item.product_name),
          ].join(' ')
        : `${record.table} ${record.order_number}`
    return text.toLocaleLowerCase().includes(query)
  })
  const paid = (invoice) => invoice.payment?.status === 'paid'
  const rows =
    type === 'orders'
      ? filtered.map((order) => [
          order.order_number,
          formatDateTime(order.created_at),
          order.table?.table_number ?? '',
          (order.items || []).map((item) => `${item.quantity} x ${item.product_name}`).join(', '),
          t(STATUS_LABELS[order.status] || order.status),
          Number(order.total_amount || 0),
        ])
      : filtered.map((invoice) => [
          invoice.order_number,
          formatDateTime(
            params.status === 'closed'
              ? invoice.payment?.paid_at || invoice.created_at
              : invoice.created_at,
          ),
          invoice.table,
          t(paid(invoice) ? 'Paid' : invoice.closed_at ? 'Closed' : 'Pending'),
          invoice.payment?.method
            ? t(
                invoice.payment.method === 'cash'
                  ? 'Cash'
                  : invoice.payment.method === 'bank'
                    ? 'Bank'
                    : 'Mixed',
              )
            : '',
          Number(invoice.paid_amount || 0),
        ])
  const numeric = [5]
  const totals = Array(6).fill('')
  totals[0] = t('Total').toUpperCase()
  for (const column of numeric)
    totals[column] = Math.round(rows.reduce((sum, row) => sum + row[column], 0) * 100) / 100
  const statusLabel =
    type === 'orders'
      ? STATUS_LABELS[params.status] || 'All Statuses'
      : params.status === 'closed'
        ? 'Paid'
        : 'Pending'
  const title = `${t(type === 'orders' ? 'Orders' : 'Payments')} - ${t(statusLabel)}`
  const section = {
    name: type === 'orders' ? 'Orders' : 'Payments',
    title,
    headers:
      type === 'orders'
        ? [
            t('Order number'),
            t('Date'),
            t('Table'),
            t('Items'),
            t('Order status'),
            `${t('Total')} (${currency})`,
          ]
        : [
            t('Invoice number'),
            t('Date'),
            t('Table'),
            t('Payment'),
            t('Payment method'),
            `${t('Total paid')} (${currency})`,
          ],
    widths: type === 'orders' ? [25, 28, 12, 44, 22, 22] : [25, 28, 16, 18, 18, 22],
    numeric,
    money: numeric,
    rows,
    totals,
    ...(query ? { note: `${t('Search')}: ${search.trim()}` } : {}),
  }
  const options = {
    filename: `${type}-${params.date_from || 'all'}-${params.date_to || 'all'}-${params.status || 'all'}`,
    title,
    data: {
      range: { from: params.date_from || t('All days'), to: params.date_to || t('All days') },
      currency,
      sections: [section],
    },
  }
  await (kind === 'excel' ? exportReportExcel(options) : exportReportPdf(options))
}
