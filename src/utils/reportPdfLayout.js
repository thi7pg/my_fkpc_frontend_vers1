import { formatReportRow } from './reportExportData'

// Use browser text shaping for Khmer/Korean and non-Latin product names.
export async function renderLocalizedPdf(doc, data) {
  const { default: html2canvas } = await import('html2canvas')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;z-index:-1'
  document.body.append(host)
  const node = (tag, text, style = '') => {
    const element = document.createElement(tag)
    if (text != null) element.textContent = String(text)
    element.style.cssText = style
    return element
  }
  const pages = data.sections.flatMap((section) => {
    const chunks = []
    // Budget for wrapped product names, header, notes and totals.
    for (let start = 0; start < Math.max(1, section.rows.length); start += 12)
      chunks.push({ section, start, last: start + 12 >= section.rows.length })
    return chunks
  })
  try {
    for (const [index, { section, start, last }] of pages.entries()) {
      const page = node(
        'div',
        null,
        'box-sizing:border-box;width:794px;height:1123px;padding:50px;background:#fff;color:#0f172a;font-size:13px;line-height:1.6;position:relative',
      )
      page.append(node('h1', section.title, 'font-size:18px;margin:0 0 6px'))
      page.append(
        node('p', data.range.from + ' - ' + data.range.to, 'font-size:12px;margin:0 0 18px'),
      )
      const table = node('table', null, 'width:100%;border-collapse:collapse;table-layout:fixed')
      const addRow = (parent, values, heading = false, total = false) => {
        const row = node('tr')
        const merge = total ? section.numeric[0] : 1
        const width = section.widths.reduce((sum, value) => sum + value, 0)
        values.forEach((value, column) => {
          if (total && column > 0 && column < merge) return
          const colWidth =
            total && column === 0
              ? section.widths.slice(0, merge).reduce((sum, value) => sum + value, 0)
              : section.widths[column]
          const cell = node(
            heading ? 'th' : 'td',
            value,
            `padding:8px;border:1px solid #d7dee2;overflow-wrap:anywhere;text-align:${section.numeric.includes(column) && !heading ? 'right' : 'left'};background:${heading ? '#dce9ee' : total ? '#ecf3f6' : '#fff'};font-weight:${heading || total ? 'bold' : 'normal'};width:${(colWidth / width) * 100}%`,
          )
          if (total && column === 0) cell.colSpan = merge
          row.append(cell)
        })
        parent.append(row)
      }
      const head = node('thead')
      addRow(head, section.headers, true)
      table.append(head)
      const body = node('tbody')
      section.rows
        .slice(start, start + 12)
        .forEach((row) => addRow(body, formatReportRow(section, row)))
      if (last && section.totals)
        addRow(body, formatReportRow(section, section.totals), false, true)
      table.append(body)
      page.append(table)
      if (section.note) page.append(node('p', section.note, 'font-size:11px;margin-top:14px'))
      page.append(
        node(
          'div',
          `${index + 1} / ${pages.length}`,
          'position:absolute;bottom:24px;right:50px;font-size:11px;color:#64748b',
        ),
      )
      host.replaceChildren(page)
      await document.fonts.ready
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff' })
      if (index) doc.addPage()
      doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)
    }
  } finally {
    host.remove()
  }
}
