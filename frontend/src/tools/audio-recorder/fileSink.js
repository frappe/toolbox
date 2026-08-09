// Optional "record straight to disk" destination, via the File System Access API.
//
// Toolbox keeps a recording in the tab until the visitor saves it, so a long capture is bounded by
// tab memory and a crash loses everything. Where this API exists, the visitor picks the file first
// and each chunk lands on their own disk instead: no memory ceiling, and nothing lost to a crash.
//
// Chromium-only today. `isFileSinkSupported` decides whether the view offers it at all, so every
// other browser simply keeps the in-memory path.

export function isFileSinkSupported(scope = globalThis) {
  return typeof scope?.showSaveFilePicker === 'function'
}

export function suggestedFileName(mimeType = '', now = new Date()) {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `recording-${stamp}.${extensionFor(mimeType)}`
}

// Ask for a destination and open it for writing. Returns null when the visitor cancels the picker,
// which is a normal outcome and must not read as an error.
export async function chooseFileSink({ mimeType = '', scope = globalThis } = {}) {
  if (!isFileSinkSupported(scope)) return null
  try {
    const handle = await scope.showSaveFilePicker({
      suggestedName: suggestedFileName(mimeType),
      types: [{ description: 'Audio', accept: { [mimeType || 'audio/webm']: [`.${extensionFor(mimeType)}`] } }],
    })
    return await handle.createWritable()
  } catch (error) {
    if (error?.name === 'AbortError') return null
    throw error
  }
}

function extensionFor(mimeType) {
  const type = String(mimeType || '').toLowerCase()
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  return 'webm'
}
