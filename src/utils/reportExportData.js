import { t } from '../languages'
import { ORDER_STATUSES, STATUS_LABELS } from './orderStatus'

const number = (value) => (value == null ? null : Number(value))
const sum = (rows, column) =>
  rows.some((row) => row[column] == null)
    ? null
    : Math.round(rows.reduce((total, row) => total + row[column], 0) * 100) / 100

export function reportData({ report, range, currency }) {
  const orders = new Map((report.orders_series || []).map((row) => [row.period, row.orders_count]))
  const daily =
    report.daily_summary ||
    (report.series || []).map((row) => ({
      period: row.period,
      orders_count: orders.get(row.period),
      paid_invoices: null,
      revenue: row.revenue,
    }))
  const salesRows = daily.map((row, index) => [
    index + 1,
    String(row.period),
    number(row.orders_count),
    number(row.paid_invoices),
    number(row.revenue),
  ])
  const products = (report.product_sales || []).map((row, index) => [
    index + 1,
    row.name,
    row.category === 'Uncategorized' ? t('Uncategorized') : row.category,
    number(row.quantity),
    number(row.sales),
  ])
  const payment = report.payment_summary || {}
  const counts = report.order_status_counts || {}
  const statusRows = ORDER_STATUSES.map((status) => [
    t(status === 'completed' ? 'Served' : STATUS_LABELS[status]),
    number(
      counts[status] ??
        (status === 'completed'
          ? report.completed_orders
          : status === 'cancelled'
            ? report.cancelled_orders
            : null),
    ),
  ])
  const money = (label) => `${t(label)} (${currency})`
  return {
    range,
    currency,
    sections: [
      {
        name: 'Sales',
        title: t('Daily sales summary'),
        headers: ['ID', t('Date'), t('Orders'), t('Paid invoices'), money('Revenue')],
        widths: [8, 24, 18, 20, 24],
        numeric: [2, 3, 4],
        money: [4],
        rows: salesRows,
        totals: [
          t('Total').toUpperCase(),
          '',
          sum(salesRows, 2),
          sum(salesRows, 3),
          sum(salesRows, 4),
        ],
      },
      {
        name: 'Payments',
        title: t('Payment summary'),
        headers: [t('Payment summary'), money('Amount')],
        widths: [42, 25],
        numeric: [1],
        money: [1],
        rows: [
          [t('Cash'), number(payment.cash)],
          [t('Bank'), number(payment.bank)],
          [t('Total paid'), number(payment.total_paid)],
          [t('Outstanding'), number(payment.outstanding)],
        ],
        note: t('Outstanding is the current unpaid balance of invoices opened in this date range.'),
      },
      {
        name: 'Products',
        title: t('Product sales details'),
        headers: ['ID', t('Product'), t('Category'), t('Quantity sold'), money('Sales amount')],
        widths: [8, 36, 26, 20, 24],
        numeric: [3, 4],
        money: [4],
        rows: products,
        totals: [t('Total').toUpperCase(), '', '', sum(products, 3), sum(products, 4)],
      },
      {
        name: 'Order status',
        title: t('Order status'),
        headers: [t('Order status'), t('Orders')],
        widths: [36, 22],
        numeric: [1],
        money: [],
        rows: statusRows,
        totals: [t('Total').toUpperCase(), number(report.total_all_orders) ?? sum(statusRows, 1)],
        note: t('Revenue uses payment dates. Order counts use order creation dates.'),
      },
    ],
  }
}

export function formatReportRow(section, row) {
  return row.map((value, column) =>
    value == null
      ? t('Unavailable')
      : section.money.includes(column)
        ? Number(value).toFixed(2)
        : String(value),
  )
}
