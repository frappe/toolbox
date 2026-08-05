import { computed, ref } from 'vue'

import * as libraryApi from './api'
import { downloadJson, downloadTextFile } from '@/utils/fileExport'

export const STATUS_TABS = ['All', 'Inbox', 'Read Later', 'Read', 'Archived', 'Favourites']
export const STATUSES = ['Inbox', 'Read Later', 'Read', 'Archived']
export const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'domain', label: 'Domain (A–Z)' },
]

// The composable owns every piece of library state and logic so the view stays thin. The real
// api module is the default, but tests inject a fake object with the same shape.
export function useLibrary({ api = libraryApi } = {}) {
  const links = ref([])
  const collections = ref([])
  const state = ref('loading')
  const errorMessage = ref('')

  const activeStatus = ref('All')
  const searchQuery = ref('')
  const sortBy = ref('recent')
  const collectionFilter = ref('')

  const form = ref(blankForm())
  const editingName = ref(null)
  const isSaving = ref(false)
  const formError = ref('')
  const duplicateHint = ref(null)
  const isFetchingMeta = ref(false)
  const metaNotice = ref('')

  const importPreview = ref(null)
  const importResult = ref(null)
  const importError = ref('')
  const isImporting = ref(false)

  // Every filter runs on the client over the full, once-fetched list so tab switches and
  // searches are instant. Search scans title, url, description, note, domain, and tags.
  const filteredLinks = computed(() => {
    const status = activeStatus.value
    const query = searchQuery.value.trim().toLowerCase()
    const collection = collectionFilter.value
    const rows = links.value.filter((link) => {
      if (status === 'Favourites') {
        if (!link.is_favourite) return false
      } else if (status !== 'All' && link.status !== status) {
        return false
      }
      if (collection && link.collection !== collection) return false
      if (!query) return true
      const haystack = [
        link.title || '',
        link.url || '',
        link.description || '',
        link.personal_note || '',
        link.domain || '',
        ...(link.tags || []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
    return [...rows].sort(comparatorFor(sortBy.value))
  })

  // Counts for the tab badges, computed from the full list so they never depend on the search.
  const statusCounts = computed(() => {
    const counts = { All: links.value.length, Favourites: 0 }
    for (const status of STATUSES) counts[status] = 0
    for (const link of links.value) {
      if (link.is_favourite) counts.Favourites += 1
      if (counts[link.status] !== undefined) counts[link.status] += 1
    }
    return counts
  })

  async function loadList() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const [rows, cols] = await Promise.all([api.listLinks(), api.listCollections()])
      links.value = Array.isArray(rows) ? rows : []
      collections.value = Array.isArray(cols) ? cols : []
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your library could not be loaded.')
    }
  }

  async function refreshCollections() {
    try {
      const cols = await api.listCollections()
      collections.value = Array.isArray(cols) ? cols : []
    } catch (error) {
      // A collection refresh failure is non-fatal; the links list is still usable.
      errorMessage.value = readError(error, 'Collections could not be refreshed.')
    }
  }

  function startCreate() {
    editingName.value = null
    form.value = blankForm()
    formError.value = ''
    duplicateHint.value = null
  }

  function startEdit(link) {
    if (!link) return
    editingName.value = link.name
    form.value = {
      name: link.name,
      url: link.url || '',
      title: link.title || '',
      description: link.description || '',
      personal_note: link.personal_note || '',
      site_name: link.site_name || '',
      collection: link.collection || '',
      status: STATUSES.includes(link.status) ? link.status : 'Inbox',
      tags: Array.isArray(link.tags) ? [...link.tags] : [],
    }
    formError.value = ''
    duplicateHint.value = null
  }

  function closeForm() {
    editingName.value = null
    form.value = blankForm()
    formError.value = ''
    duplicateHint.value = null
  }

  // Persist the form. When the server reports a duplicate (and the caller did not force it), no
  // record is created; a hint is surfaced so the user can open the existing link or save anyway.
  async function saveForm({ allowDuplicate = false } = {}) {
    const draft = form.value
    if (!(draft.url || '').trim()) {
      formError.value = 'Enter a URL to save.'
      return null
    }
    isSaving.value = true
    formError.value = ''
    try {
      const saved = await api.saveLink({
        name: draft.name || undefined,
        url: draft.url.trim(),
        title: draft.title,
        description: draft.description,
        personal_note: draft.personal_note,
        site_name: draft.site_name,
        collection: draft.collection,
        status: draft.status,
        tags: draft.tags,
        allow_duplicate: allowDuplicate,
      })
      if (saved && saved.saved === false) {
        duplicateHint.value = {
          name: saved.duplicate_of,
          link: saved.duplicate || null,
          normalised_url: saved.normalised_url || '',
        }
        return null
      }
      duplicateHint.value = null
      upsertLink(saved)
      closeForm()
      return saved
    } catch (error) {
      formError.value = readError(error, 'This link could not be saved.')
      return null
    } finally {
      isSaving.value = false
    }
  }

  // Fetch page metadata for the URL in the form and fill only the fields the user left blank,
  // so a manual title/description is never overwritten. Failure is non-fatal — save still works.
  async function fetchMetadata() {
    const url = (form.value.url || '').trim()
    if (!url) {
      formError.value = 'Enter a URL first.'
      return
    }
    isFetchingMeta.value = true
    metaNotice.value = ''
    formError.value = ''
    try {
      const result = await api.fetchMetadata(url)
      if (!result || result.ok === false) {
        metaNotice.value = (result && result.error) || 'No metadata could be fetched. You can still save manually.'
        return
      }
      if (!form.value.title && result.title) form.value.title = result.title
      if (!form.value.description && result.description) form.value.description = result.description
      if (!form.value.site_name && result.site_name) form.value.site_name = result.site_name
      metaNotice.value = 'Fetched. Review and save.'
    } catch (error) {
      metaNotice.value = readError(error, 'Metadata could not be fetched. You can still save manually.')
    } finally {
      isFetchingMeta.value = false
    }
  }

  // Open the pre-existing link a duplicate warning pointed at, loading it into the edit form.
  function openExistingDuplicate() {
    const target = duplicateHint.value
    duplicateHint.value = null
    if (!target?.name) return
    const hit = links.value.find((link) => link.name === target.name)
    if (hit) startEdit(hit)
  }

  async function removeLink(name) {
    if (!name) return
    try {
      await api.deleteLink(name)
      links.value = links.value.filter((link) => link.name !== name)
      if (editingName.value === name) closeForm()
    } catch (error) {
      errorMessage.value = readError(error, 'This link could not be deleted.')
    }
  }

  async function changeStatus(name, status) {
    if (!name || !STATUSES.includes(status)) return
    try {
      const saved = await api.setStatus(name, status)
      upsertLink(saved)
    } catch (error) {
      errorMessage.value = readError(error, "This link's status could not be changed.")
    }
  }

  async function toggleFavourite(name) {
    if (!name) return
    try {
      const saved = await api.toggleFavourite(name)
      upsertLink(saved)
    } catch (error) {
      errorMessage.value = readError(error, 'This link could not be updated.')
    }
  }

  async function saveCollection(data) {
    try {
      await api.saveCollection(data)
      await refreshCollections()
      return true
    } catch (error) {
      errorMessage.value = readError(error, 'This collection could not be saved.')
      return false
    }
  }

  async function removeCollection(name) {
    try {
      await api.deleteCollection(name)
      await refreshCollections()
      return true
    } catch (error) {
      errorMessage.value = readError(error, 'This collection could not be deleted.')
      return false
    }
  }

  async function exportJson() {
    try {
      const data = await api.exportLinks()
      return downloadJson('library-links.json', data?.links || [])
    } catch (error) {
      errorMessage.value = readError(error, 'Your links could not be exported.')
      return false
    }
  }

  async function exportCsv() {
    try {
      const data = await api.exportLinks()
      const csv = toCsv(data?.csv_columns || [], data?.csv_rows || [])
      return downloadTextFile('library-links.csv', csv, 'text/csv')
    } catch (error) {
      errorMessage.value = readError(error, 'Your links could not be exported.')
      return false
    }
  }

  // Parse a JSON export or a Netscape bookmark HTML file into candidates and build a preview
  // with a best-effort duplicate estimate. The authoritative dedupe still happens on commit.
  function previewImport(text, filename = '') {
    importError.value = ''
    importResult.value = null
    let candidates = []
    try {
      candidates = parseImport(text, filename)
    } catch {
      importError.value = 'This file could not be read as JSON or bookmarks HTML.'
      importPreview.value = null
      return null
    }
    if (!candidates.length) {
      importError.value = 'No links were found in this file.'
      importPreview.value = null
      return null
    }
    const existing = new Set(links.value.map((link) => normaliseUrlClient(link.url)).filter(Boolean))
    let duplicates = 0
    const items = candidates.map((candidate) => {
      const key = normaliseUrlClient(candidate.url)
      const isDuplicate = Boolean(key && existing.has(key))
      if (isDuplicate) duplicates += 1
      return { ...candidate, isDuplicate }
    })
    importPreview.value = {
      items,
      total: items.length,
      duplicates,
      newCount: items.length - duplicates,
    }
    return importPreview.value
  }

  function cancelImport() {
    importPreview.value = null
    importError.value = ''
  }

  // Commit the previewed candidates. Each save runs without forcing duplicates, so links the
  // server already has are skipped rather than duplicated.
  async function commitImport() {
    const preview = importPreview.value
    if (!preview) return null
    isImporting.value = true
    let imported = 0
    let skipped = 0
    let failed = 0
    for (const item of preview.items) {
      try {
        const saved = await api.saveLink({
          url: item.url,
          title: item.title || '',
          description: item.description || '',
          personal_note: item.personal_note || '',
          collection: item.collection || '',
          status: STATUSES.includes(item.status) ? item.status : 'Inbox',
          tags: item.tags || [],
        })
        if (saved && saved.saved === false) skipped += 1
        else {
          imported += 1
          upsertLink(saved)
        }
      } catch {
        failed += 1
      }
    }
    isImporting.value = false
    importPreview.value = null
    importResult.value = { imported, skipped, failed }
    return importResult.value
  }

  // Replace (or insert) a link row from the authoritative server response.
  function upsertLink(saved) {
    if (!saved?.name) return
    const summary = {
      name: saved.name,
      url: saved.url,
      normalised_url: saved.normalised_url,
      title: saved.title,
      description: saved.description,
      site_name: saved.site_name,
      domain: saved.domain,
      personal_note: saved.personal_note,
      collection: saved.collection,
      status: saved.status,
      is_favourite: Boolean(saved.is_favourite),
      tags: Array.isArray(saved.tags) ? saved.tags : [],
      creation: saved.creation,
      modified: saved.modified,
    }
    const index = links.value.findIndex((link) => link.name === saved.name)
    if (index === -1) links.value = [summary, ...links.value]
    else links.value.splice(index, 1, summary)
  }

  return {
    links,
    collections,
    state,
    errorMessage,
    activeStatus,
    searchQuery,
    sortBy,
    collectionFilter,
    form,
    editingName,
    isSaving,
    formError,
    duplicateHint,
    isFetchingMeta,
    metaNotice,
    importPreview,
    importResult,
    importError,
    isImporting,
    filteredLinks,
    statusCounts,
    loadList,
    refreshCollections,
    startCreate,
    startEdit,
    closeForm,
    saveForm,
    fetchMetadata,
    openExistingDuplicate,
    removeLink,
    changeStatus,
    toggleFavourite,
    saveCollection,
    removeCollection,
    exportJson,
    exportCsv,
    previewImport,
    cancelImport,
    commitImport,
    safeHref,
    normaliseUrlClient,
  }
}

function blankForm() {
  return {
    name: null,
    url: '',
    title: '',
    description: '',
    personal_note: '',
    site_name: '',
    collection: '',
    status: 'Inbox',
    tags: [],
  }
}

function comparatorFor(sort) {
  if (sort === 'oldest') return (a, b) => String(a.modified || '').localeCompare(String(b.modified || ''))
  if (sort === 'title') {
    return (a, b) => labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: 'base' })
  }
  if (sort === 'domain') {
    return (a, b) => String(a.domain || '').localeCompare(String(b.domain || ''), undefined, { sensitivity: 'base' })
  }
  // recent (default): most recently modified first.
  return (a, b) => String(b.modified || '').localeCompare(String(a.modified || ''))
}

function labelOf(link) {
  return link.title || link.domain || link.url || ''
}

function parseImport(text, filename = '') {
  const name = (filename || '').toLowerCase()
  const trimmed = (text || '').trim()
  const looksJson = name.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')
  return looksJson ? parseJsonImport(trimmed) : parseNetscapeHtml(text || '')
}

function parseJsonImport(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : Array.isArray(data?.links) ? data.links : []
  return list
    .map((entry) => ({
      url: (entry.url || entry.href || '').trim(),
      title: entry.title || entry.name || '',
      description: entry.description || '',
      personal_note: entry.personal_note || entry.note || '',
      collection: entry.collection || '',
      status: entry.status || 'Inbox',
      tags: normaliseTags(entry.tags),
    }))
    .filter((entry) => entry.url)
}

// Parse a Netscape bookmark export: a flat list of <A HREF> anchors, each optionally carrying a
// comma-separated TAGS attribute (as Chrome/Firefox and many bookmark tools emit).
function parseNetscapeHtml(html) {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const anchors = Array.from(doc.querySelectorAll('a[href]'))
  return anchors
    .map((anchor) => ({
      url: (anchor.getAttribute('href') || '').trim(),
      title: (anchor.textContent || '').trim(),
      description: '',
      personal_note: '',
      collection: '',
      status: 'Inbox',
      tags: normaliseTags(anchor.getAttribute('tags')),
    }))
    .filter((entry) => entry.url && safeHref(entry.url))
}

function normaliseTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  return []
}

function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return `${lines.join('\r\n')}\r\n`
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Mirror of the server URL normalisation, used only for the client-side duplicate estimate in
// the import preview. The server remains the single source of truth on save.
export function normaliseUrlClient(input) {
  const withScheme = applySchemeClient(input)
  if (!withScheme) return null
  let url
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  const scheme = url.protocol.replace(':', '').toLowerCase()
  if (scheme !== 'http' && scheme !== 'https') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host) return null
  // The URL API already drops default ports (80/443) from `port`.
  const netloc = url.port ? `${host}:${url.port}` : host
  const path = (url.pathname || '').replace(/\/+$/, '')
  return `${scheme}://${netloc}${path}${url.search || ''}`
}

function applySchemeClient(input) {
  const raw = (input || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw
  const match = raw.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):/)
  if (match) {
    const scheme = match[1].toLowerCase()
    const rest = raw.slice(match[0].length)
    if (scheme === 'http' || scheme === 'https') return `${scheme}://${rest.replace(/^\/+/, '')}`
    if (scheme.includes('.') || /^[0-9]/.test(rest)) return `https://${raw}`
    return null
  }
  return `https://${raw.replace(/^\/+/, '')}`
}

// Only ever return an http/https href. Anything else (javascript:, data:, file:, …) returns null
// so the view never renders a dangerous link.
export function safeHref(url) {
  const schemed = applySchemeClient(url)
  if (!schemed) return null
  const lower = schemed.toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://') ? schemed : null
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
