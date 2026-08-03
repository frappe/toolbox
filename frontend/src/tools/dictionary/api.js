import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.dictionary'

export function lookup(word, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.lookup`,
    method: 'GET',
    params: { word },
  })
}

export function suggest(query, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.suggest`,
    method: 'GET',
    params: { query },
  })
}

export function getDatasetStatus(request = frappeRequest) {
  return request({ url: `${API_ROOT}.get_dataset_status`, method: 'GET' })
}
