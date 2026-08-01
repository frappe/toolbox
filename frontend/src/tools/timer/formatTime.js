export function formatDuration(milliseconds, precise = false) {
  const safe = Math.max(0, Number(milliseconds) || 0)
  const totalSeconds = Math.floor(safe / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const base = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  return precise ? `${base}.${String(Math.floor((safe % 1000) / 10)).padStart(2, '0')}` : base
}
