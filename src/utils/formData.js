export function toFormData(fields) {
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (typeof value === 'boolean') {
      formData.append(key, value ? '1' : '0')
      return
    }
    formData.append(key, value)
  })
  return formData
}
