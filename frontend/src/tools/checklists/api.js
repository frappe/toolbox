import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.checklists'

// The current user's checklists as summary rows, pinned first then most recent.
export function listChecklists(includeArchived = 0, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.list_checklists`,
    method: 'GET',
    params: { include_archived: includeArchived ? 1 : 0 },
  })
}

// One checklist with its items and settings.
export function getChecklist(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.get_checklist`,
    method: 'GET',
    params: { name },
  })
}

// Create (omit name) or update a checklist. The server expects a JSON string, so the
// whole payload is stringified into a single `payload` param.
export function saveChecklist(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_checklist`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteChecklist(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.delete_checklist`,
    method: 'POST',
    params: { name },
  })
}

// Copy a checklist as a fresh, incomplete, unpinned list; returns the new checklist.
export function duplicateChecklist(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.duplicate_checklist`,
    method: 'POST',
    params: { name },
  })
}
