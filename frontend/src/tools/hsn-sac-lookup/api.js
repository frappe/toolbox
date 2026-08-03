import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.hsn'

export function fetchHsnStatus(request = frappeRequest) {
  return request({ url: `${API_ROOT}.get_dataset_status`, method: 'GET' })
}

export function searchHsn(query, request = frappeRequest) {
  return request({ url: `${API_ROOT}.search_hsn`, method: 'GET', params: { query, limit: 25 } })
}
