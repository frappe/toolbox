import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.india_business'

export function fetchDatasetStatus(request = frappeRequest) {
  return request({ url: `${API_ROOT}.get_dataset_status`, method: 'GET' })
}

export function searchBusinessDataset(datasetType, query, request = frappeRequest) {
  const method = datasetType === 'pin' ? 'search_pin' : 'search_ifsc'
  return request({
    url: `${API_ROOT}.${method}`,
    method: 'GET',
    params: { query, limit: 20 },
  })
}
