// Hands one recording from the Recorder to the Editor without a round trip through the server.
//
// Toolbox stores nothing, so the two views pass a Blob directly. The handoff is module state in
// one SPA: it does not survive a reload, and `take` clears it so a stale blob can never reappear
// on a later visit to the Editor.

let pending = null

export function offerRecording(blob, { name = '' } = {}) {
  if (!blob || !blob.size) return false
  pending = { blob, name }
  return true
}

// Returns the offered recording once, then forgets it.
export function takeRecording() {
  const offered = pending
  pending = null
  return offered
}

export function hasRecording() {
  return pending !== null
}
