// Deterministic WMO weather_code (0..99) descriptions. Icons are lucide names.
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'lucide-sun' },
  1: { label: 'Mainly clear', icon: 'lucide-sun' },
  2: { label: 'Partly cloudy', icon: 'lucide-cloud-sun' },
  3: { label: 'Overcast', icon: 'lucide-cloud' },
  45: { label: 'Fog', icon: 'lucide-cloud-fog' },
  48: { label: 'Depositing rime fog', icon: 'lucide-cloud-fog' },
  51: { label: 'Light drizzle', icon: 'lucide-cloud-drizzle' },
  53: { label: 'Moderate drizzle', icon: 'lucide-cloud-drizzle' },
  55: { label: 'Dense drizzle', icon: 'lucide-cloud-drizzle' },
  56: { label: 'Light freezing drizzle', icon: 'lucide-cloud-drizzle' },
  57: { label: 'Dense freezing drizzle', icon: 'lucide-cloud-drizzle' },
  61: { label: 'Slight rain', icon: 'lucide-cloud-rain' },
  63: { label: 'Moderate rain', icon: 'lucide-cloud-rain' },
  65: { label: 'Heavy rain', icon: 'lucide-cloud-rain' },
  66: { label: 'Light freezing rain', icon: 'lucide-cloud-rain' },
  67: { label: 'Heavy freezing rain', icon: 'lucide-cloud-rain' },
  71: { label: 'Slight snowfall', icon: 'lucide-cloud-snow' },
  73: { label: 'Moderate snowfall', icon: 'lucide-cloud-snow' },
  75: { label: 'Heavy snowfall', icon: 'lucide-cloud-snow' },
  77: { label: 'Snow grains', icon: 'lucide-cloud-snow' },
  80: { label: 'Slight rain showers', icon: 'lucide-cloud-rain' },
  81: { label: 'Moderate rain showers', icon: 'lucide-cloud-rain' },
  82: { label: 'Violent rain showers', icon: 'lucide-cloud-rain' },
  85: { label: 'Slight snow showers', icon: 'lucide-cloud-snow' },
  86: { label: 'Heavy snow showers', icon: 'lucide-cloud-snow' },
  95: { label: 'Thunderstorm', icon: 'lucide-cloud-lightning' },
  96: { label: 'Thunderstorm with slight hail', icon: 'lucide-cloud-lightning' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'lucide-cloud-lightning' },
}

const UNKNOWN_WEATHER = { label: 'Unknown', icon: 'lucide-cloud' }
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function describeWeatherCode(code) {
  return WEATHER_CODES[code] ?? UNKNOWN_WEATHER
}

export function windCompass(degrees) {
  if (!Number.isFinite(degrees)) return ''
  const normalized = ((degrees % 360) + 360) % 360
  return COMPASS_POINTS[Math.round(normalized / 45) % 8]
}
