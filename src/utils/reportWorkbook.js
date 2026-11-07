import { locale, t } from '../languages'

export function styleReportWorkbook(book, data, options) {
  const font = locale.value === 'km' ? 'Khmer OS Siemreap' : 'Calibri'
  for (const section of data.sections) {
    const sheet = book.addWorksheet(section.name, {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    })
    sheet.columns = section.widths.map((width) => ({ width }))
    sheet.addRow(section.headers)
    section.rows.forEach((row) => sheet.addRow(row.map((value) => value ?? t('Unavailable'))))
    const end = sheet.rowCount
    let total
    if (section.totals) {
      total = sheet.addRow(section.totals.map((value) => value ?? t('Unavailable')))
      for (const column of section.numeric) {
        if (
          section.rows.length &&
          section.totals[column] != null &&
          section.rows.every((row) => typeof row[column] === 'number')
        ) {
          const letter = sheet.getColumn(column + 1).letter
          total.getCell(column + 1).value = {
            formula: `SUM(${letter}2:${letter}${end})`,
            result: section.totals[column],
          }
        }
      }
    }
    sheet.eachRow((row, index) => {
      row.height = 28
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = {
          name: font,
          size: 11,
          bold: index === 1 || index === total?.number,
          color: { argb: 'FF0F172A' },
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: section.numeric.includes(column - 1) && index > 1 ? 'right' : 'left',
          indent: 1,
          wrapText: true,
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD7DEE2' } },
          right: { style: 'thin', color: { argb: 'FFD7DEE2' } },
        }
        if (index === 1 || index === total?.number)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: index === 1 ? 'FFDCE9EE' : 'FFECF3F6' },
          }
        if (index > 1 && section.numeric.includes(column - 1))
          cell.numFmt = section.money.includes(column - 1) ? options.moneyFormat : '#,##0'
      })
    })
    if (total && section.numeric[0] > 1)
      sheet.mergeCells(total.number, 1, total.number, section.numeric[0])
    const lastColumn = sheet.getColumn(section.headers.length).letter
    sheet.autoFilter = `A1:${lastColumn}${end}`
    sheet.pageSetup.printTitlesRow = '1:1'
    sheet.addRow([])
    const range = sheet.addRow([`${t('From')}: ${data.range.from}   ${t('To')}: ${data.range.to}`])
    sheet.mergeCells(range.number, 1, range.number, section.headers.length)
    range.font = { name: font, size: 10 }
    if (section.note) {
      const note = sheet.addRow([section.note])
      sheet.mergeCells(note.number, 1, note.number, section.headers.length)
      note.font = { name: font, size: 10 }
      note.alignment = { wrapText: true }
      note.height = 45
    }
    sheet.pageSetup.printArea = `A1:${lastColumn}${sheet.rowCount}`
  }
}
