// Curated cities so people can search "Mumbai" or "Pune" — not only IANA zone
// identifiers — and canonicalisation so alias zones (Asia/Calcutta) collapse into
// their modern name (Asia/Kolkata) instead of showing up twice.

// Well-known IANA aliases → their canonical zone. Some browsers still surface the
// legacy links in Intl.supportedValuesOf('timeZone'); collapse them here.
export const ZONE_ALIASES = Object.freeze({
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Chongqing': 'Asia/Shanghai',
  'Asia/Harbin': 'Asia/Shanghai',
  'Asia/Istanbul': 'Europe/Istanbul',
  'Europe/Kiev': 'Europe/Kyiv',
  'Europe/Nicosia': 'Asia/Nicosia',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'US/Hawaii': 'Pacific/Honolulu',
  'US/Alaska': 'America/Anchorage',
  GB: 'Europe/London',
})

export function canonicalizeZone(zone) {
  return ZONE_ALIASES[zone] ?? zone
}

// name · zone · region (for the secondary line and search) · aliases (alternate
// spellings people may type). India first (all Asia/Kolkata) so tier-1/2 cities
// resolve, then major world cities.
export const CITIES = Object.freeze([
  { name: 'Mumbai', zone: 'Asia/Kolkata', region: 'India', aliases: ['Bombay'] },
  { name: 'Delhi', zone: 'Asia/Kolkata', region: 'India', aliases: ['New Delhi'] },
  { name: 'Bengaluru', zone: 'Asia/Kolkata', region: 'India', aliases: ['Bangalore'] },
  { name: 'Hyderabad', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Chennai', zone: 'Asia/Kolkata', region: 'India', aliases: ['Madras'] },
  { name: 'Kolkata', zone: 'Asia/Kolkata', region: 'India', aliases: ['Calcutta'] },
  { name: 'Pune', zone: 'Asia/Kolkata', region: 'India', aliases: ['Poona'] },
  { name: 'Ahmedabad', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Jaipur', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Surat', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Lucknow', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Kanpur', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Nagpur', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Indore', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Bhopal', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Visakhapatnam', zone: 'Asia/Kolkata', region: 'India', aliases: ['Vizag'] },
  { name: 'Patna', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Vadodara', zone: 'Asia/Kolkata', region: 'India', aliases: ['Baroda'] },
  { name: 'Coimbatore', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Kochi', zone: 'Asia/Kolkata', region: 'India', aliases: ['Cochin'] },
  { name: 'Chandigarh', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Gurugram', zone: 'Asia/Kolkata', region: 'India', aliases: ['Gurgaon'] },
  { name: 'Noida', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Thiruvananthapuram', zone: 'Asia/Kolkata', region: 'India', aliases: ['Trivandrum'] },
  { name: 'Guwahati', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Bhubaneswar', zone: 'Asia/Kolkata', region: 'India' },
  { name: 'Mysuru', zone: 'Asia/Kolkata', region: 'India', aliases: ['Mysore'] },
  { name: 'Goa', zone: 'Asia/Kolkata', region: 'India', aliases: ['Panaji'] },

  { name: 'Dubai', zone: 'Asia/Dubai', region: 'United Arab Emirates' },
  { name: 'Abu Dhabi', zone: 'Asia/Dubai', region: 'United Arab Emirates' },
  { name: 'Singapore', zone: 'Asia/Singapore', region: 'Singapore' },
  { name: 'Hong Kong', zone: 'Asia/Hong_Kong', region: 'Hong Kong' },
  { name: 'Tokyo', zone: 'Asia/Tokyo', region: 'Japan' },
  { name: 'Osaka', zone: 'Asia/Tokyo', region: 'Japan' },
  { name: 'Seoul', zone: 'Asia/Seoul', region: 'South Korea' },
  { name: 'Shanghai', zone: 'Asia/Shanghai', region: 'China' },
  { name: 'Beijing', zone: 'Asia/Shanghai', region: 'China' },
  { name: 'Bangkok', zone: 'Asia/Bangkok', region: 'Thailand' },
  { name: 'Jakarta', zone: 'Asia/Jakarta', region: 'Indonesia' },
  { name: 'Kuala Lumpur', zone: 'Asia/Kuala_Lumpur', region: 'Malaysia' },
  { name: 'Manila', zone: 'Asia/Manila', region: 'Philippines' },
  { name: 'Karachi', zone: 'Asia/Karachi', region: 'Pakistan' },
  { name: 'Dhaka', zone: 'Asia/Dhaka', region: 'Bangladesh' },
  { name: 'Colombo', zone: 'Asia/Colombo', region: 'Sri Lanka' },
  { name: 'Kathmandu', zone: 'Asia/Kathmandu', region: 'Nepal' },
  { name: 'Riyadh', zone: 'Asia/Riyadh', region: 'Saudi Arabia' },
  { name: 'Tel Aviv', zone: 'Asia/Jerusalem', region: 'Israel' },
  { name: 'Istanbul', zone: 'Europe/Istanbul', region: 'Türkiye' },

  { name: 'London', zone: 'Europe/London', region: 'United Kingdom' },
  { name: 'Dublin', zone: 'Europe/Dublin', region: 'Ireland' },
  { name: 'Paris', zone: 'Europe/Paris', region: 'France' },
  { name: 'Berlin', zone: 'Europe/Berlin', region: 'Germany' },
  { name: 'Frankfurt', zone: 'Europe/Berlin', region: 'Germany' },
  { name: 'Madrid', zone: 'Europe/Madrid', region: 'Spain' },
  { name: 'Rome', zone: 'Europe/Rome', region: 'Italy' },
  { name: 'Amsterdam', zone: 'Europe/Amsterdam', region: 'Netherlands' },
  { name: 'Zurich', zone: 'Europe/Zurich', region: 'Switzerland' },
  { name: 'Lisbon', zone: 'Europe/Lisbon', region: 'Portugal' },
  { name: 'Stockholm', zone: 'Europe/Stockholm', region: 'Sweden' },
  { name: 'Warsaw', zone: 'Europe/Warsaw', region: 'Poland' },
  { name: 'Athens', zone: 'Europe/Athens', region: 'Greece' },
  { name: 'Moscow', zone: 'Europe/Moscow', region: 'Russia' },

  { name: 'New York', zone: 'America/New_York', region: 'United States' },
  { name: 'Washington', zone: 'America/New_York', region: 'United States' },
  { name: 'Toronto', zone: 'America/Toronto', region: 'Canada' },
  { name: 'Chicago', zone: 'America/Chicago', region: 'United States' },
  { name: 'Denver', zone: 'America/Denver', region: 'United States' },
  { name: 'Los Angeles', zone: 'America/Los_Angeles', region: 'United States' },
  { name: 'San Francisco', zone: 'America/Los_Angeles', region: 'United States' },
  { name: 'Seattle', zone: 'America/Los_Angeles', region: 'United States' },
  { name: 'Vancouver', zone: 'America/Vancouver', region: 'Canada' },
  { name: 'Mexico City', zone: 'America/Mexico_City', region: 'Mexico' },
  { name: 'Bogotá', zone: 'America/Bogota', region: 'Colombia', aliases: ['Bogota'] },
  { name: 'São Paulo', zone: 'America/Sao_Paulo', region: 'Brazil', aliases: ['Sao Paulo'] },
  { name: 'Buenos Aires', zone: 'America/Argentina/Buenos_Aires', region: 'Argentina' },

  { name: 'Sydney', zone: 'Australia/Sydney', region: 'Australia' },
  { name: 'Melbourne', zone: 'Australia/Melbourne', region: 'Australia' },
  { name: 'Perth', zone: 'Australia/Perth', region: 'Australia' },
  { name: 'Auckland', zone: 'Pacific/Auckland', region: 'New Zealand' },
  { name: 'Honolulu', zone: 'Pacific/Honolulu', region: 'United States' },

  { name: 'Cairo', zone: 'Africa/Cairo', region: 'Egypt' },
  { name: 'Johannesburg', zone: 'Africa/Johannesburg', region: 'South Africa' },
  { name: 'Lagos', zone: 'Africa/Lagos', region: 'Nigeria' },
  { name: 'Nairobi', zone: 'Africa/Nairobi', region: 'Kenya' },

  { name: 'UTC', zone: 'UTC', region: 'Coordinated Universal Time', aliases: ['GMT'] },
])

export function slug(value) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
