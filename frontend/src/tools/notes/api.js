import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.notes'

// The current user's notes as summary rows, pinned first then most recent.
export function listNotes(includeArchived = 0, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.list_notes`,
    method: 'GET',
    params: { include_archived: includeArchived ? 1 : 0 },
  })
}

// One note with its full content and settings.
export function getNote(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.get_note`,
    method: 'GET',
    params: { name },
  })
}

// Create (omit name) or update a note. The server expects a JSON string, so the whole
// payload is stringified into a single `payload` param.
export function saveNote(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_note`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteNote(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.delete_note`,
    method: 'POST',
    params: { name },
  })
}

// Copy a note as a fresh, unpinned note; returns the new note.
export function duplicateNote(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.duplicate_note`,
    method: 'POST',
    params: { name },
  })
}
