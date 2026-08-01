import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.hsn_dependency'
const CATALOG_API = 'toolbox.hsn_catalog.get_hsn_catalog'

export function fetchHsnDependencyStatus(taskId = '', request = frappeRequest) {
  return request({
    url: `${API_ROOT}.get_dependency_status`,
    method: 'GET',
    params: taskId ? { task_id: taskId } : undefined,
  })
}

export function requestIndiaComplianceInstall(request = frappeRequest) {
  return request({
    url: `${API_ROOT}.install_india_compliance`,
    method: 'POST',
    params: { confirmed: true },
  })
}

export function fetchHsnCatalog(knownRevision = '', request = frappeRequest) {
  return request({
    url: CATALOG_API,
    method: 'GET',
    params: knownRevision ? { known_revision: knownRevision } : undefined,
  })
}
