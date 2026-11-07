import { locale } from '../languages'
import { reportData, formatReportRow } from './reportExportData'

export async function exportReportPdf(options) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const data = options.data || reportData(options)
  const doc = new jsPDF()
  doc.setProperties({
    title: options.title || 'Revenue Report',
    subject: `${data.range.from} to ${data.range.to}`,
  })
  if (locale.value !== 'en' || /[^\x20-\x7E]/.test(JSON.stringify(data.sections))) {
    const { renderLocalizedPdf } = await import('./reportPdfLayout')
    await renderLocalizedPdf(doc, data)
  } else {
    for (const [index, section] of data.sections.entries()) {
      if (index) doc.addPage()
      doc.setFontSize(13)
      doc.setTextColor(15, 23, 42)
      doc.text(section.title, 14, 17)
      doc.setFontSize(9)
      doc.text(data.range.from + ' to ' + data.range.to, 14, 24)
      autoTable(doc, {
        startY: 30,
        margin: { left: 14, right: 14, top: 16, bottom: 24 },
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 3,
          lineColor: [215, 222, 226],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
        },
        headStyles: { fillColor: [220, 233, 238], textColor: [15, 23, 42], fontStyle: 'bold' },
        footStyles: { fillColor: [236, 243, 246], textColor: [15, 23, 42], fontStyle: 'bold' },
        head: [section.headers],
        body: section.rows.map((row) => formatReportRow(section, row)),
        foot: section.totals
          ? [
              formatReportRow(section, section.totals)
                .map((value, column) =>
                  column === 0 && section.headers.length > 2
                    ? { content: value, colSpan: section.numeric[0] }
                    : value,
                )
                .filter((_, column) => column === 0 || column >= section.numeric[0]),
            ]
          : [],
        showFoot: 'lastPage',
        columnStyles: Object.fromEntries(
          section.numeric.map((column) => [column, { halign: 'right' }]),
        ),
      })
      if (section.note) {
        doc.setFontSize(8)
        doc.text(doc.splitTextToSize(section.note, 180), 14, 277)
      }
    }
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(`Page ${page} of ${pages}`, 196, 289, { align: 'right' })
    }
  }
  doc.save(`${options.filename}.pdf`)
}

export async function exportReportExcel(options) {
  const { default: ExcelJS } = await import('exceljs')
  const data = options.data || reportData(options)
  const book = new ExcelJS.Workbook()
  book.creator = 'Reports'
  book.created = new Date()
  const moneyFormat = `"${data.currency}" #,##0.00;[Red]-"${data.currency}" #,##0.00`
  const { styleReportWorkbook } = await import('./reportWorkbook')
  styleReportWorkbook(book, data, { ...options, moneyFormat })
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
