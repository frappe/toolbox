import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.reminders'

// The caller's reminders for a scope: 'active' (scheduled, soonest first), 'completed', or 'all'.
export function listReminders(scope = 'active', request = frappeRequest) {
  return request({ url: `${API_ROOT}.list_reminders`, method: 'GET', params: { scope } })
}

// One reminder with all its fields.
export function getReminder(name, request = frappeRequest) {
  return request({ url: `${API_ROOT}.get_reminder`, method: 'GET', params: { name } })
}

// Create (omit name) or update a reminder. The server expects a JSON string in `payload`.
export function saveReminder(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_reminder`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteReminder(name, request = frappeRequest) {
  return request({ url: `${API_ROOT}.delete_reminder`, method: 'POST', params: { name } })
}

// Mark a reminder done for good; clears its notifications.
export function completeReminder(name, request = frappeRequest) {
  return request({ url: `${API_ROOT}.complete_reminder`, method: 'POST', params: { name } })
}

// Re-point the next fire. Pass either a preset ('10m' | '30m' | '1h' | 'tomorrow') or a custom
// `until` as a UTC ISO 8601 string.
export function snoozeReminder(name, { preset = null, until = null } = {}, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.snooze_reminder`,
    method: 'POST',
    params: { name, preset, until },
  })
}

// The in-app inbox: delivered, not-yet-acknowledged notifications, soonest first.
export function listDue(request = frappeRequest) {
  return request({ url: `${API_ROOT}.list_due`, method: 'GET' })
}

// Dismiss one in-app notification by its delivery name.
export function acknowledge(delivery, request = frappeRequest) {
  return request({ url: `${API_ROOT}.acknowledge`, method: 'POST', params: { delivery } })
}
