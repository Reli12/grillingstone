// Lets the browser download data as a JSON file, for exporting Template bundles.
/** Saves `data` as a pretty-printed JSON file through the browser's download. */
export function downloadJson(name: string, data: unknown) {
  const json = JSON.stringify(data, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
