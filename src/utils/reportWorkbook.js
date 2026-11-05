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
  summary.pageSetup.printArea = `A1:F${11 + data.metrics.length}`
}
