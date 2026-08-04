import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.checklists'
const TEMPLATES_ROOT = 'toolbox.checklist_templates'

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

// System templates (shared) plus the user's own personal templates.
export function listTemplates(request = frappeRequest) {
  return request({ url: `${TEMPLATES_ROOT}.list_templates`, method: 'GET' })
}

// Create a new checklist seeded from a template; returns the full checklist.
export function createChecklistFromTemplate(template, request = frappeRequest) {
  return request({
    url: `${TEMPLATES_ROOT}.create_checklist_from_template`,
    method: 'POST',
    params: { template },
  })
}

// Save the given checklist's items as a new personal template.
export function saveAsTemplate(checklist, templateName, request = frappeRequest) {
  return request({
    url: `${TEMPLATES_ROOT}.save_as_template`,
    method: 'POST',
    params: { checklist, template_name: templateName },
  })
}

export function deleteTemplate(name, request = frappeRequest) {
  return request({ url: `${TEMPLATES_ROOT}.delete_template`, method: 'POST', params: { name } })
}
