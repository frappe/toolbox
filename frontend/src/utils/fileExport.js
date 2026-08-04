// Client-side download helpers. DOM-only; no Frappe calls.
// Safe to import outside a browser (SSR, unit tests): each helper no-ops and
// returns false when the required browser APIs are missing.

// Build a Blob for `text`, download it as `filename`, then release the URL.
export function downloadTextFile(filename, text, mimeType = 'text/plain') {
  const canDownload =
    typeof document !== 'undefined' &&
    typeof globalThis.URL?.createObjectURL === 'function'
  if (!canDownload) return false

  const url = globalThis.URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  globalThis.URL.revokeObjectURL(url)
  return true
}

// Download `data` as pretty-printed JSON.
export function downloadJson(filename, data) {
  return downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json')
}
