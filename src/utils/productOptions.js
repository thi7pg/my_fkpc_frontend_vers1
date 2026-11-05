export function productPrice(product, sizeName = '', toppingNames = []) {
  const size = product.sizes?.find((option) => option.name === sizeName)
  const base = Math.round(Number(size?.price ?? product.price) * 100)
  const discounted = Math.round(base * (1 - Number(product.discount_percent || 0) / 100))
  const extras = (product.toppings || [])
    .filter((option) => toppingNames.includes(option.name))
    .reduce((sum, option) => sum + Math.round(Number(option.price) * 100), 0)
  return (discounted + extras) / 100
}

export function productLabel(product, size = '', toppings = []) {
  const options = [size, ...toppings].filter(Boolean)
  return options.length ? `${product.name} (${options.join(', ')})` : product.name
}
