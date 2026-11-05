import { t, locale, intlLocale } from '../languages'
import { localizedMetric } from './reportLabels'

// Keep exported figures numeric and use the same snapshot for both formats.
function reportData({ report, range, currency }) {
  const revenue = Number(report.total_revenue || 0)
  const paid = Number(report.total_orders || 0)
  const count = (value) =>
    value == null ? (locale.value === 'en' ? 'Unavailable' : '—') : Number(value)
  return {
    range,
    currency,
    generated: new Date().toLocaleString(intlLocale()),
    sections: [
      ...(Array.isArray(report.daily_summary)
        ? [
            {
              name: 'Daily sales',
              title: 'Daily sales summary',
              headers: ['Date', 'Revenue', 'Paid invoices', 'Orders placed'],
              moneyColumns: [1],
              rows: report.daily_summary.map((row) => [
                row.period,
                row.revenue,
                row.paid_invoices,
                row.orders_count,
              ]),
            },
          ]
        : []),
      ...(Array.isArray(report.product_sales)
        ? [
            {
              name: 'Products',
              title: 'Product sales details',
              headers: ['Product', 'Category', 'Quantity sold', 'Sales amount'],
              moneyColumns: [3],
              rows: report.product_sales.map((row) => [
                row.name,
                row.category === 'Uncategorized' ? t('Uncategorized') : row.category,
                row.quantity,
                row.sales,
              ]),
            },
          ]
        : []),
      ...(Array.isArray(report.category_sales)
        ? [
            {
              name: 'Categories',
              title: 'Sales by category',
              headers: ['Category', 'Quantity sold', 'Sales amount'],
              moneyColumns: [2],
              rows: report.category_sales.map((row) => [
                row.name === 'Uncategorized' ? t('Uncategorized') : row.name,
                row.quantity,
                row.sales,
              ]),
            },
          ]
        : []),
      ...(Array.isArray(report.top_products)
        ? [
            {
              name: 'Best sellers',
              title: 'Top 5 best-selling products',
              headers: ['Product', 'Quantity sold', 'Sales amount'],
              moneyColumns: [2],
              rows: report.top_products.map((row) => [row.name, row.quantity, row.sales]),
            },
          ]
        : []),
    ],
    metrics: [
      ['Total revenue', revenue, true],
      ...(report.total_all_orders != null
        ? [['Total orders', count(report.total_all_orders)]]
        : []),
      ['Paid orders', paid],
      ['Completed orders', count(report.completed_orders)],
      ['Cancelled orders', count(report.cancelled_orders)],
      ['Total invoices', count(report.total_invoices)],
    ],
    rows: (report.series || []).map((point) => [
      String(point.period),
      Number(point.revenue || 0),
      Number(point.orders_count || 0),
    ]),
  }
}

export async function exportReportPdf(options) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const data = reportData(options)
  const doc = new jsPDF()
  doc.setProperties({ title: 'Revenue Report', subject: `${data.range.from} to ${data.range.to}` })
  if (locale.value !== 'en' || /[^\x20-\x7E]/.test(JSON.stringify(data.sections))) {
    const { renderLocalizedPdf } = await import('./reportPdfLayout')
    await renderLocalizedPdf(doc, data, options)
    doc.save(`${options.filename}.pdf`)
    return
  }
  doc.setFillColor(255, 240, 243)
  doc.rect(16, 10, 178, 29, 'F')
  doc.setTextColor(206, 2, 51)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(23)
  doc.text('Revenue Report', 16, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${data.range.from} to ${data.range.to}`, 16, 30)
  doc.setTextColor(70)
  doc.text(`Currency: ${data.currency}    |    Grouping: ${data.range.groupBy}`, 16, 49)
  doc.text(`Generated: ${data.generated}`, 16, 56)
  const tableStyle = {
    margin: { left: 16, right: 16, top: 16, bottom: 20 },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3.5 },
    headStyles: { fillColor: [255, 240, 243], textColor: [174, 0, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  }
  autoTable(doc, {
    ...tableStyle,
    startY: 63,
    head: [['Summary', 'Value']],
    body: data.metrics.map(([label, value, monetary]) => [
      label,
      monetary ? `${data.currency} ${value.toFixed(2)}` : String(value),
    ]),
    columnStyles: { 1: { halign: 'right' } },
  })
  autoTable(doc, {
    ...tableStyle,
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Period', `Revenue (${data.currency})`, 'Paid orders']],
    body: data.rows.length
      ? data.rows.map(([period, revenue, orders]) => [period, revenue.toFixed(2), String(orders)])
      : [['No revenue in this range', '', '']],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })
  for (const section of data.sections) {
    doc.addPage()
    doc.setFontSize(16)
    doc.setTextColor(206, 2, 51)
    doc.text(section.title, 16, 22)
    autoTable(doc, {
      ...tableStyle,
      startY: 30,
      head: [section.headers],
      body: section.rows.length
        ? section.rows.map((row) =>
            row.map((value, column) =>
              section.moneyColumns.includes(column) ? Number(value).toFixed(2) : String(value),
            ),
          )
        : [[t('No data yet')]],
      columnStyles: Object.fromEntries(
        section.moneyColumns.map((column) => [column, { halign: 'right' }]),
      ),
    })
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(options.brand || 'Revenue Report', 16, 285)
    doc.text(`Page ${page} of ${pages}`, 194, 291, { align: 'right' })
  }
  doc.save(`${options.filename}.pdf`)
}

export async function exportReportExcel(options) {
  const { default: ExcelJS } = await import('exceljs')
  const data = reportData(options)
  const book = new ExcelJS.Workbook()
  book.creator = 'Reports'
  book.created = new Date()
  const moneyFormat = `"${data.currency}" #,##0.00;[Red]-"${data.currency}" #,##0.00`
  const { styleReportWorkbook } = await import('./reportWorkbook')
  styleReportWorkbook(book, data, { ...options, moneyFormat, metricLabel: localizedMetric })
  const buffer = await book.xlsx.writeBuffer()
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${options.filename}.xlsx`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
