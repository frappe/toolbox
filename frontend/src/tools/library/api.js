import { frappeRequest } from 'frappe-ui'

const API_ROOT = 'toolbox.library'

// The current user's saved links as summary rows, most recently modified first. All filters
// are optional; the view filters mostly on the client, but the server supports them too.
export function listLinks(filters = {}, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.list_links`,
    method: 'GET',
    params: {
      status: filters.status || '',
      collection: filters.collection || '',
      tag: filters.tag || '',
      search: filters.search || '',
    },
  })
}

// One saved link with all of its fields.
export function getLink(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.get_link`,
    method: 'GET',
    params: { name },
  })
}

// Create (omit name) or update a link. The server expects a JSON string, so the whole payload
// is stringified into a single `payload` param. A duplicate returns `{ saved: false,
// duplicate_of }` unless `allow_duplicate` is set.
export function saveLink(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_link`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteLink(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.delete_link`,
    method: 'POST',
    params: { name },
  })
}

// Fetch title/description/site name for a URL through the SSRF-guarded server fetcher.
// Returns { ok: true, ...metadata } or { ok: false, error }; the link is always still savable.
export function fetchMetadata(url, request = frappeRequest) {
  return request({ url: `${API_ROOT}.fetch_metadata`, method: 'POST', params: { url } })
}

export function setStatus(name, status, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.set_status`,
    method: 'POST',
    params: { name, status },
  })
}

export function toggleFavourite(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.toggle_favourite`,
    method: 'POST',
    params: { name },
  })
}

export function listCollections(request = frappeRequest) {
  return request({
    url: `${API_ROOT}.list_collections`,
    method: 'GET',
  })
}

export function saveCollection(data, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.save_collection`,
    method: 'POST',
    params: { payload: JSON.stringify(data) },
  })
}

export function deleteCollection(name, request = frappeRequest) {
  return request({
    url: `${API_ROOT}.delete_collection`,
    method: 'POST',
    params: { name },
  })
}

// Every saved link as JSON records plus CSV-ready columns and rows. The frontend builds and
// triggers the downloads from this data.
export function exportLinks(request = frappeRequest) {
  return request({
    url: `${API_ROOT}.export_links`,
    method: 'GET',
  })
}
