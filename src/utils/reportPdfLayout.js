import { t } from '../languages'
import { localizedMetric, reportGroupingLabel } from './reportLabels'

// Browser text shaping preserves Khmer and Korean. Tailwind styles are shared
// with the report screen, then each A4 page is captured into the downloaded PDF.
export async function renderLocalizedPdf(doc, data, options) {
  const { default: html2canvas } = await import('html2canvas')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;z-index:-1'
  document.body.append(host)
  const node = (tag, classes, text) => {
    const element = document.createElement(tag)
    element.className = classes
    if (text != null) element.textContent = text
    return element
  }
  const groups = []
  let offset = 0
  do {
    const capacity = groups.length === 0 ? 14 : 25
    groups.push({
      rows: data.rows
        .slice(offset, offset + capacity)
        .map(([period, revenue, orders]) => [period, revenue.toFixed(2), orders]),
      headers: [t('Period'), `${t('Revenue')} (${data.currency})`, t('Orders Paid')],
    })
    offset += capacity
  } while (offset < data.rows.length)
  for (const section of data.sections || []) {
    const rows = section.rows.map((row) =>
      row.map((value, column) =>
        section.moneyColumns.includes(column) ? Number(value).toFixed(2) : value,
      ),
    )
    for (let start = 0; start < Math.max(1, rows.length); start += 12)
      groups.push({
        title: t(section.title),
        headers: section.headers.map((label) => t(label)),
        rows: rows.slice(start, start + 12),
      })
  }
  try {
    for (let index = 0; index < groups.length; index++) {
      const page = node('div', 'relative box-border bg-white px-12 py-10 text-slate-900')
      page.style.cssText = 'width:794px;height:1123px;font-size:13px;line-height:1.8'
      const header = node('div', 'flex items-center gap-4 border-b border-slate-200 pb-5')
      if (options.logo) {
        const logo = node('img', 'h-14 w-14 object-contain')
        logo.src = options.logo
        header.append(logo)
      }
      const titles = node('div', 'flex-1')
      titles.append(node('div', 'text-sm font-semibold text-primary-600', options.brand))
      titles.append(node('h1', 'text-2xl font-bold', t('Reports')))
      titles.append(
        node('p', 'mt-1 text-xs text-slate-500', `${data.range.from} — ${data.range.to}`),
      )
      header.append(titles)
      page.append(header)
      page.append(
        node(
          'p',
          'mt-4 text-xs text-slate-500',
          `${t('Currency')}: ${data.currency} · ${reportGroupingLabel(data.range.groupBy)}`,
        ),
      )
      if (index === 0) {
        const metrics = node('div', 'my-5 grid grid-cols-2 gap-3')
        for (const [label, value, monetary] of data.metrics) {
          const card = node('div', 'rounded-2xl border border-slate-200 bg-white px-4 py-3')
          card.append(node('p', 'text-xs text-slate-500', localizedMetric(label)))
          card.append(
            node(
              'p',
              'mt-1 text-lg font-bold',
              monetary ? `${data.currency} ${value.toFixed(2)}` : String(value),
            ),
          )
          metrics.append(card)
        }
        page.append(metrics)
      }
      if (groups[index].title)
        page.append(node('h2', 'mt-5 font-bold text-primary-700', groups[index].title))
      const table = node('table', 'mt-5 w-full border-collapse text-sm')
      const head = node('thead', 'bg-primary-50 text-primary-700')
      const heading = node('tr', '')
      for (const label of groups[index].headers) {
        heading.append(
          node('th', 'border-b border-primary-100 px-4 py-3 text-left font-semibold', label),
        )
      }
      head.append(heading)
      table.append(head)
      const body = node('tbody', '')
      for (const values of groups[index].rows) {
        const row = node('tr', 'border-b border-slate-100')
        for (const value of values) row.append(node('td', 'px-4 py-2', value))
        body.append(row)
      }
      table.append(body)
      page.append(table)
      if (!data.rows.length)
        page.append(
          node(
            'p',
            'rounded-b-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-slate-500',
            t('No revenue in this range'),
          ),
        )
      page.append(
        node(
          'footer',
          'absolute right-12 bottom-8 left-12 flex justify-between border-t border-slate-200 pt-3 text-xs text-slate-500',
          `${options.brand || t('Reports')} · ${data.generated} · ${index + 1} / ${groups.length}`,
        ),
      )
      host.replaceChildren(page)
      await document.fonts.ready
      await Promise.all(
        [...page.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
      )
      // html2canvas does not parse Tailwind v4's oklch colors. Resolve computed
      // colors through the browser canvas into standard sRGB before capture.
      const canvas = await html2canvas(page, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        onclone: (cloned) => {
          const context = cloned.createElement('canvas').getContext('2d')
          for (const element of cloned.querySelectorAll('body *')) {
            const style = cloned.defaultView.getComputedStyle(element)
            for (const property of [
              'color',
              'background-color',
              'border-top-color',
              'border-right-color',
              'border-bottom-color',
              'border-left-color',
            ]) {
              context.fillStyle = style.getPropertyValue(property)
              context.fillRect(0, 0, 1, 1)
              const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
              element.style.setProperty(property, `rgba(${r},${g},${b},${a / 255})`)
              context.clearRect(0, 0, 1, 1)
            }
            element.style.boxShadow = 'none'
          }
        },
      })
      if (index) doc.addPage()
      doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)
    }
  } finally {
    host.remove()
  }
}
