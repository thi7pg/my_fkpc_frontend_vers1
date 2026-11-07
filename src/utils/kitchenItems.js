import { locale, t } from '../languages'

const aliases = {
  'pizza chheese': 'Cheese pizza',
  'pizza cheese': 'Cheese pizza',
  'cheese pizza': 'Cheese pizza',
  'korean cheese pizza': 'Korean cheese pizza',
  pizza: 'Pizza',
  'ice latte': 'Iced latte',
  'iced latte': 'Iced latte',
  'fried fish cutlet': 'Fried fish cutlet',
  cheese: 'Cheese',
}
const sizes = {
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Extra large',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

export function kitchenText(value) {
  if (!value) return ''
  return String(value)
    .split('\n')
    .map((line) => {
      const text = line.trim()
      const percentage = text.match(/^(.*?)\s+(\d+(?:\.\d+)?%)$/)
      if (percentage) return `${kitchenText(percentage[1])} ${percentage[2]}`
      return t(aliases[text.toLowerCase()] || text)
    })
    .join('\n')
}

export function kitchenItem(item) {
  const original = item.product_name || item.product?.name || ''
  let name = original
  let size = typeof item.size === 'string' ? item.size : item.size?.name || ''
  let toppings = Array.isArray(item.toppings)
    ? item.toppings
        .map((option) => (typeof option === 'string' ? option : option.name))
        .filter(Boolean)
    : []
  const match = original.match(/^(.*?)\s+\(([^()]*)\)$/)
  if (match) {
    const options = match[2].split(',').map((value) => value.trim())
    // Only parse the legacy suffix when its first value is a known size.
    // Parentheses can also be part of a dish's actual name.
    if (sizes[options[0].toLowerCase()]) {
      name = match[1]
      size ||= options[0]
      if (!toppings.length) toppings = options.slice(1)
    }
  }
  const translatedName =
    item[`product_name_${locale.value}`] || item.product?.[`name_${locale.value}`]
  return {
    name: translatedName || kitchenText(name),
    size: size ? `${t(sizes[size.toLowerCase()] || size)} (${size})` : '',
    toppings: toppings.map(kitchenText),
    description:
      item[`description_${locale.value}`] ||
      item.product?.[`description_${locale.value}`] ||
      kitchenText(item.description || item.product?.description),
  }
}
