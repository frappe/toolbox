import { frappeRequest } from 'frappe-ui'

export function getDataSources(request = frappeRequest) {
  return request({ url: 'toolbox.data_sources.get_data_sources', method: 'GET' })
}
