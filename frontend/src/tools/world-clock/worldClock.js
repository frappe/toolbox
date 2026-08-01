const FALLBACK_ZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
]

export function availableTimeZones() {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : FALLBACK_ZONES
  return [...new Set(['UTC', ...zones])]
}

export function searchTimeZones(query, zones = availableTimeZones(), limit = 12) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  if (!terms.length) return []

  return zones
    .map((zone) => ({ zone, label: zoneLabel(zone), search: normalizeSearch(`${zone} ${zoneLabel(zone)}`) }))
    .filter(({ search }) => terms.every((term) => search.includes(term)))
    .sort((left, right) => compareMatches(left, right, terms.join(' ')))
    .slice(0, limit)
    .map(({ zone, label }) => ({ zone, label }))
}

export function describeZonedTime(instant, zone, referenceZone = localTimeZone()) {
  const parts = zonedParts(instant, zone)
  const referenceParts = zonedParts(instant, referenceZone)
  const offsetMinutes = timeZoneOffsetMinutes(instant, zone)
  const standardOffset = standardOffsetMinutes(parts.year, zone)

  return {
    ...parts,
    zone,
    label: zoneLabel(zone),
    dateKey: dateKey(parts),
    dayDifference: compareDateKeys(dateKey(parts), dateKey(referenceParts)),
    offsetMinutes,
    offsetLabel: formatUtcOffset(offsetMinutes),
    daylightSaving: offsetMinutes !== standardOffset,
  }
}

export function isWithinWorkingHours(description, startHour, endHour) {
  const minutes = description.hour * 60 + description.minute
  return minutes >= startHour * 60 && minutes < endHour * 60
}

export function selectedInstant(now, offsetHours) {
  return new Date(now.getTime() + Number(offsetHours) * 60 * 60 * 1000)
}

export function formatUtcOffset(minutes) {
  if (minutes === 0) return 'UTC'
  const sign = minutes < 0 ? '−' : '+'
  const absolute = Math.abs(minutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
  const remainder = String(absolute % 60).padStart(2, '0')
  return `UTC${sign}${hours}:${remainder}`
}

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function zoneLabel(zone) {
  if (zone === 'UTC') return 'UTC'
  return zone.split('/').at(-1).replaceAll('_', ' ')
}

function zonedParts(instant, zone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const values = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  )
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function timeZoneOffsetMinutes(instant, zone) {
  const parts = zonedParts(instant, zone)
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return Math.round((representedAsUtc - instant.getTime()) / 60_000)
}

function standardOffsetMinutes(year, zone) {
  return Math.min(
    timeZoneOffsetMinutes(new Date(Date.UTC(year, 0, 1, 12)), zone),
    timeZoneOffsetMinutes(new Date(Date.UTC(year, 6, 1, 12)), zone),
  )
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function compareDateKeys(left, right) {
  const difference = (Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000
  return Math.max(-1, Math.min(1, difference))
}

function compareMatches(left, right, query) {
  const leftStarts = left.search.startsWith(query)
  const rightStarts = right.search.startsWith(query)
  if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
  return left.label.localeCompare(right.label) || left.zone.localeCompare(right.zone)
}

function normalizeSearch(value) {
  return value.toLowerCase().replaceAll(/[_/]+/g, ' ').replaceAll(/\s+/g, ' ').trim()
}
