import { CITIES, canonicalizeZone, slug } from './worldClockCities'

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
  // Canonicalise so alias links (e.g. Asia/Calcutta) collapse into their modern
  // name and stop appearing twice.
  return [...new Set(['UTC', ...zones].map(canonicalizeZone))]
}

export function searchTimeZones(query, zones = availableTimeZones(), limit = 12) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  if (!terms.length) return []

  return buildLocationIndex(zones)
    .filter(({ search }) => terms.every((term) => search.includes(term)))
    .sort((left, right) => compareMatches(left, right, terms.join(' ')))
    .slice(0, limit)
    .map(({ id, zone, label, region }) => ({ id, zone, label, region }))
}

// Curated cities (friendly names, multiple per zone) plus any canonical IANA zone
// not already covered by a city — so "Mumbai" and "Pune" both resolve, aliases
// never double up, and obscure zones stay searchable.
function buildLocationIndex(zones) {
  const entries = CITIES.map((city) => {
    const zone = canonicalizeZone(city.zone)
    return {
      id: locationKey(city.name, zone),
      zone,
      label: city.name,
      region: city.region,
      search: normalizeSearch([city.name, city.region, zone, ...(city.aliases ?? [])].join(' ')),
    }
  })

  const covered = new Set(entries.map((entry) => entry.zone))
  for (const rawZone of zones) {
    const zone = canonicalizeZone(rawZone)
    if (covered.has(zone)) continue
    covered.add(zone)
    entries.push({
      id: locationKey(zoneLabel(zone), zone),
      zone,
      label: zoneLabel(zone),
      region: zoneRegion(zone),
      search: normalizeSearch(`${zone} ${zoneLabel(zone)}`),
    })
  }
  return entries
}

function zoneRegion(zone) {
  if (zone === 'UTC') return 'Coordinated Universal Time'
  return zone.split('/')[0].replaceAll('_', ' ')
}

// A location's identity is its friendly label plus its canonical zone, so the same
// zone can hold several cities (Mumbai and Pune) while aliases never double up.
export function locationKey(label, zone) {
  return `${slug(label)}:${zone}`
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

// The instant whose wall-clock time in `zone` is the given components (month 1-12).
export function zonedWallTimeToInstant({ year, month, day, hour, minute }, zone) {
  const asUtcComponents = Date.UTC(year, month - 1, day, hour, minute)
  let instant = asUtcComponents
  // Two refinements settle daylight-saving boundaries: wall = instant + offset,
  // so instant = components − offset.
  for (let index = 0; index < 2; index += 1) {
    const offsetMinutes = timeZoneOffsetMinutes(new Date(instant), zone)
    instant = asUtcComponents - offsetMinutes * 60_000
  }
  return new Date(instant)
}

export function parseDateTimeLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? ''))
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  return { year, month, day, hour, minute }
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
