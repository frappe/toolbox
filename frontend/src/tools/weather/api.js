import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.weather'

export function searchLocations(query, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.search_locations`,
    method: 'GET',
    params: { query },
  })
}

export function getForecast({ latitude, longitude, timezone } = {}, request = frappeRequest) {
  const params = { latitude, longitude }
  if (timezone) params.timezone = timezone
  return request({
    url: `${API_ROOT}.get_forecast`,
    method: 'GET',
    params,
  })
}
