import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.audio'

// Save a recording. `data` is base64 (a data: URL is accepted; the server strips the prefix).
export function saveRecording(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_recording`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function listRecordings(request = frappeRequest) {
  return request({ url: `${API_ROOT}.list_recordings`, method: 'GET' })
}

export function updateRecording(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.update_recording`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteRecording(name, request = frappeRequest) {
  return request({ url: `${API_ROOT}.delete_recording`, method: 'POST', params: { name } })
}
