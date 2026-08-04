import { computed, ref } from 'vue'

import * as notesApi from './api'
import { downloadTextFile } from '@/utils/fileExport'

// A short pause after content or title edits collapses fast typing into a single save.
// Structural changes (pin, archive, tags, delete) skip the wait and persist immediately.
export const SAVE_DEBOUNCE_MS = 600

const EXCERPT_LEN = 160

// The composable owns every piece of note state and logic so the view stays thin. The real
// api module is the default, but tests inject a fake object with the same shape.
export function useNotes({ api = notesApi } = {}) {
  const notes = ref([])
  const activeNote = ref(null)
  const state = ref('loading')
  const errorMessage = ref('')
  const showArchived = ref(false)
  const searchQuery = ref('')
  const isOpening = ref(false)
  const isSaving = ref(false)
  const saveError = ref('')

  let saveTimer = null
  let saveToken = 0

  // Archived notes are always fetched so toggling the switch is a client-side filter, never
  // a refetch. Search scans title, the content-derived text, and tags case-insensitively.
  const filteredNotes = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return notes.value.filter((note) => {
      if (!showArchived.value && note.is_archived) return false
      if (!query) return true
      const haystack = [note.title || '', note.excerpt || '', note.search_text || '', ...(note.tags || [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })

  async function loadList() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const rows = await api.listNotes(1)
      notes.value = Array.isArray(rows) ? rows : []
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your notes could not be loaded.')
    }
  }

  async function openNote(name) {
    if (!name) return
    isOpening.value = true
    saveError.value = ''
    try {
      const note = await api.getNote(name)
      activeNote.value = normalizeNote(note)
    } catch (error) {
      saveError.value = readError(error, 'This note could not be opened.')
    } finally {
      isOpening.value = false
    }
  }

  function closeActive() {
    activeNote.value = null
  }

  // Persist a blank note, then open it so the user starts writing immediately.
  async function createNote() {
    saveError.value = ''
    try {
      const created = await api.saveNote({
        title: 'Untitled note',
        content_html: '',
        content_json: null,
        is_pinned: false,
        is_archived: false,
        tags: [],
      })
      activeNote.value = normalizeNote(created)
      syncSummary(created)
    } catch (error) {
      saveError.value = readError(error, 'A new note could not be created.')
    }
  }

  async function deleteActive() {
    const note = activeNote.value
    if (!note?.name) return
    try {
      await api.deleteNote(note.name)
      notes.value = notes.value.filter((row) => row.name !== note.name)
      activeNote.value = null
    } catch (error) {
      saveError.value = readError(error, 'This note could not be deleted.')
    }
  }

  async function duplicateActive() {
    const note = activeNote.value
    if (!note?.name) return
    try {
      const copy = await api.duplicateNote(note.name)
      activeNote.value = normalizeNote(copy)
      syncSummary(copy)
    } catch (error) {
      saveError.value = readError(error, 'This note could not be duplicated.')
    }
  }

  function togglePin() {
    if (!activeNote.value) return
    activeNote.value.is_pinned = !activeNote.value.is_pinned
    save()
  }

  function toggleArchive() {
    if (!activeNote.value) return
    activeNote.value.is_archived = !activeNote.value.is_archived
    save()
  }

  function setTags(tags) {
    if (!activeNote.value) return
    activeNote.value.tags = Array.isArray(tags) ? [...tags] : []
    save()
  }

  function setTitle(text) {
    if (!activeNote.value) return
    activeNote.value.title = text
    scheduleSave()
  }

  function setContentHtml(html) {
    if (!activeNote.value) return
    activeNote.value.content_html = html || ''
    scheduleSave()
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void save()
    }, SAVE_DEBOUNCE_MS)
  }

  // Persist the active note. A failed save keeps every local edit and only reports the
  // error, so the user never loses work. Stale saves never overwrite a newer one.
  async function save() {
    clearTimeout(saveTimer)
    saveTimer = null
    const note = activeNote.value
    if (!note) return
    const payload = buildPayload(note)
    const token = ++saveToken
    isSaving.value = true
    saveError.value = ''
    try {
      const saved = await api.saveNote(payload)
      if (token === saveToken) {
        if (activeNote.value?.name === saved.name) {
          activeNote.value.name = saved.name
          activeNote.value.modified = saved.modified
          activeNote.value.search_text = saved.search_text
        }
        syncSummary(saved)
      }
    } catch (error) {
      saveError.value = readError(error, 'Your changes could not be saved. They are still here — try again.')
    } finally {
      if (token === saveToken) isSaving.value = false
    }
  }

  function exportMarkdown() {
    const note = activeNote.value
    if (!note) return false
    const body = htmlToText(note.content_html)
    const contents = `# ${note.title || 'Untitled note'}\n\n${body}\n`.replace(/\n{3,}/g, '\n\n')
    return downloadTextFile(`${fileSlug(note.title)}.md`, contents, 'text/markdown')
  }

  function exportHtml() {
    const note = activeNote.value
    if (!note) return false
    const title = escapeHtml(note.title || 'Untitled note')
    const contents =
      '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n' +
      `<title>${title}</title>\n</head>\n<body>\n<h1>${title}</h1>\n` +
      `${note.content_html || ''}\n</body>\n</html>\n`
    return downloadTextFile(`${fileSlug(note.title)}.html`, contents, 'text/html')
  }

  function buildPayload(note) {
    return {
      name: note.name,
      title: note.title,
      content_html: note.content_html || '',
      content_json: note.content_json || null,
      is_pinned: note.is_pinned,
      is_archived: note.is_archived,
      tags: note.tags || [],
    }
  }

  // Replace (or insert) the summary row for a saved note from the authoritative server
  // response, so the list reflects the new title, pin, archive, and excerpt without a refetch.
  function syncSummary(saved) {
    const summary = {
      name: saved.name,
      title: saved.title,
      excerpt: excerptFrom(saved.search_text),
      search_text: saved.search_text || '',
      is_pinned: Boolean(saved.is_pinned),
      is_archived: Boolean(saved.is_archived),
      tags: Array.isArray(saved.tags) ? saved.tags : [],
      modified: saved.modified,
    }
    const index = notes.value.findIndex((note) => note.name === saved.name)
    if (index === -1) notes.value = [summary, ...notes.value]
    else notes.value.splice(index, 1, summary)
  }

  return {
    notes,
    activeNote,
    state,
    errorMessage,
    showArchived,
    searchQuery,
    isOpening,
    isSaving,
    saveError,
    filteredNotes,
    loadList,
    openNote,
    closeActive,
    createNote,
    deleteActive,
    duplicateActive,
    togglePin,
    toggleArchive,
    setTags,
    setTitle,
    setContentHtml,
    save,
    exportMarkdown,
    exportHtml,
  }
}

function normalizeNote(raw) {
  if (!raw) return null
  return {
    name: raw.name,
    title: raw.title || '',
    content_html: raw.content_html || '',
    content_json: raw.content_json || null,
    search_text: raw.search_text || '',
    is_pinned: Boolean(raw.is_pinned),
    is_archived: Boolean(raw.is_archived),
    tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
    creation: raw.creation || null,
    modified: raw.modified || null,
  }
}

function excerptFrom(text) {
  const value = (text || '').trim()
  return value.length > EXCERPT_LEN ? `${value.slice(0, EXCERPT_LEN).trimEnd()}…` : value
}

// A light HTML -> plain/markdown-ish conversion for the Markdown export. Block ends become
// line breaks and list items gain a dash; remaining tags are stripped and a few common
// entities are decoded. Good enough for a readable text export, not a full converter.
function htmlToText(html) {
  if (!html) return ''
  let text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fileSlug(title) {
  const slug = (title || 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'note'
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
