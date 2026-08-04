const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// A short, human-friendly "how long ago" label for a history entry. Older entries fall back
// to a localized calendar date so the panel never shows an unbounded "1234 days ago".
export function formatHistoryTimestamp(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return ''

  const elapsed = now - timestamp
  if (elapsed < 0) return 'Just now'
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY)
    return days === 1 ? '1 day ago' : `${days} days ago`
  }

  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(timestamp),
    )
  } catch {
    return ''
  }
}

// The absolute date and time used as the entry's tooltip / accessible detail.
export function formatHistoryTimestampTitle(timestamp) {
  if (!Number.isFinite(timestamp)) return ''

  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(timestamp),
    )
  } catch {
    return ''
  }
}
