import { t, locale } from '../languages'
import { reportGroupingLabel } from './reportLabels'

export function styleReportWorkbook(book, data, options) {
  const font = locale.value === 'km' ? 'Khmer OS Siemreap' : 'Calibri'
  const pink = 'FFCE0233'
  const pale = 'FFFFF0F3'
  const fill = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } })
  const sheet = (name, widths) => {
    const result = book.addWorksheet(name, {
      properties: { tabColor: { argb: pink }, defaultRowHeight: 30 },
      views: [{ showGridLines: false, zoomScale: 100 }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
      headerFooter: {
        oddFooter: '&L' + (options.brand || 'Reports').replaceAll('&', '&&') + '&R&P / &N',
      },
    })
    result.columns = widths.map((width) => ({ width }))
    return result
  }
  const merged = (target, range, value, settings = {}) => {
    target.mergeCells(range)
    const cell = target.getCell(range.split(':')[0])
    cell.value = value
    cell.font = { name: font, size: 11, color: { argb: 'FF0F172A' }, ...settings }
    cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
    return cell
  }
  const title = (target, lastColumn) => {
    merged(target, `A1:${lastColumn}2`, t('Reports'), {
      size: 22,
      bold: true,
      color: { argb: pink },
    }).fill = fill(pale)
    target.getRow(1).height = 26
    target.getRow(2).height = 26
    merged(target, `A3:${lastColumn}3`, options.brand || 'Reports', {
      bold: true,
      color: { argb: 'FF64748B' },
    })
  }
  const summary = sheet('Summary', [22, 14, 14, 18, 16, 16])
  title(summary, 'F')
  const grouping = reportGroupingLabel(data.range.groupBy)
  for (const [index, label, value] of [
    [5, t('From'), data.range.from],
    [6, t('To'), data.range.to],
    [7, t('Currency'), data.currency],
    [8, t('Report grouping'), grouping],
    [9, t('Generated'), data.generated],
  ]) {
    merged(summary, `A${index}:B${index}`, label, { color: { argb: 'FF64748B' } })
    merged(summary, `C${index}:F${index}`, value, { bold: true })
    summary.getRow(index).height = 33
  }
  merged(summary, 'A11:D11', t('Summary'), { bold: true, color: { argb: pink } }).fill = fill(pale)
  merged(summary, 'E11:F11', t('Value'), { bold: true, color: { argb: pink } }).fill = fill(pale)
  data.metrics.forEach(([label, value, monetary], index) => {
    const row = 12 + index
    const labelCell = merged(summary, `A${row}:D${row}`, options.metricLabel(label))
    const valueCell = merged(summary, `E${row}:F${row}`, value, {
      size: monetary ? 20 : 15,
      bold: true,
      color: { argb: monetary ? pink : 'FF0F172A' },
    })
    valueCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
    valueCell.numFmt = monetary ? options.moneyFormat : '#,##0'
    for (const cell of [labelCell, valueCell]) {
      cell.fill = fill(index % 2 ? 'FFF8FAFC' : 'FFFFFFFF')
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
    }
    summary.getRow(row).height = monetary ? 52 : 38
  })
  const noteRow = 14 + data.metrics.length
  merged(
    summary,
    `A${noteRow}:F${noteRow + 1}`,
    t('Revenue uses payment dates. Order counts use order creation dates.'),
    { size: 10, color: { argb: 'FF64748B' } },
  )
  const linkRow = noteRow + 3
  const link = merged(
    summary,
    `A${linkRow}:F${linkRow}`,
    { text: t('View table'), hyperlink: "#'Revenue'!A1" },
    { bold: true, color: { argb: pink }, underline: true },
  )
  link.fill = fill(pale)
  summary.pageSetup.printArea = `A1:F${linkRow}`

  const revenue = sheet('Revenue', [30, 32, 30])
  title(revenue, 'C')
  merged(revenue, 'A5:C5', `${data.range.from} — ${data.range.to}  |  ${grouping}`, {
    color: { argb: 'FF64748B' },
  })
  revenue.views = [{ state: 'frozen', ySplit: 7, showGridLines: false }]
  const header = revenue.getRow(7)
  header.values = [t('Period'), `${t('Revenue')} (${data.currency})`, t('Orders Paid')]
  header.height = 38
  header.eachCell((cell) => {
    cell.fill = fill(pale)
    cell.font = { name: font, bold: true, size: 11, color: { argb: pink } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }
  })
  data.rows.forEach((values, index) => {
    const row = revenue.getRow(8 + index)
    row.values = values
    row.height = 32
    row.eachCell((cell, column) => {
      cell.font = { name: font, size: 11, color: { argb: 'FF0F172A' } }
      cell.fill = fill(index % 2 ? 'FFF8FAFC' : 'FFFFFFFF')
      cell.alignment = {
        vertical: 'middle',
        horizontal: column === 1 ? 'left' : 'right',
        indent: 1,
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
    })
    row.getCell(2).numFmt = options.moneyFormat
    row.getCell(3).numFmt = '#,##0'
  })
  const last = 7 + data.rows.length
  const totalRow = Math.max(9, last + 1)
  if (!data.rows.length) merged(revenue, 'A8:C8', t('No revenue in this range'))
  const total = revenue.getRow(totalRow)
  total.values = [
    t('Total'),
    data.rows.length
      ? { formula: `SUM(B8:B${last})`, result: data.rows.reduce((sum, row) => sum + row[1], 0) }
      : 0,
    data.rows.length
      ? { formula: `SUM(C8:C${last})`, result: data.rows.reduce((sum, row) => sum + row[2], 0) }
      : 0,
  ]
  total.height = 38
  total.eachCell((cell) => {
    cell.font = { name: font, bold: true, color: { argb: pink } }
    cell.fill = fill(pale)
    cell.alignment = {
      vertical: 'middle',
      horizontal: cell.col === 1 ? 'left' : 'right',
      indent: 1,
    }
  })
  total.getCell(2).numFmt = options.moneyFormat
  total.getCell(3).numFmt = '#,##0'
  revenue.autoFilter = `A7:C${Math.max(7, last)}`
  revenue.pageSetup.printTitlesRow = '1:7'
  revenue.pageSetup.printArea = `A1:C${totalRow}`
  for (const section of data.sections || []) {
    const extra = sheet(
      section.name,
      section.headers.map((_, column) => (column === 0 ? 36 : 26)),
    )
    extra.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
    extra.addRow(section.headers.map((label) => t(label)))
    section.rows.forEach((row) => extra.addRow(row))
    extra.eachRow((row, index) => {
      row.height = 32
      row.eachCell((cell, column) => {
        cell.font = {
          name: font,
          size: 11,
          bold: index === 1,
          color: { argb: index === 1 ? pink : 'FF0F172A' },
        }
        cell.fill = fill(index === 1 ? pale : index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF')
        cell.alignment = { vertical: 'middle', wrapText: true }
        if (index > 1 && section.moneyColumns.includes(column - 1))
          cell.numFmt = options.moneyFormat
      })
    })
    const endColumn = String.fromCharCode(64 + section.headers.length)
    extra.autoFilter = `A1:${endColumn}${Math.max(1, section.rows.length + 1)}`
    extra.pageSetup.printTitlesRow = '1:1'
    extra.pageSetup.printArea = `A1:${endColumn}${Math.max(1, section.rows.length + 1)}`
  }
  book.calcProperties.fullCalcOnLoad = true
}
