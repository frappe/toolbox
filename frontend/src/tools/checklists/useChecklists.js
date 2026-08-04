import { computed, ref } from 'vue'

import * as checklistsApi from './api'
import { downloadJson, downloadTextFile } from '@/utils/fileExport'

// A short pause after text edits collapses fast typing into a single save. Structural
// changes (add, remove, reorder, complete) skip the wait and persist immediately.
export const SAVE_DEBOUNCE_MS = 600

// The composable owns every piece of checklist state and logic so the view stays thin.
// The real api module is the default, but tests inject a fake object with the same shape.
export function useChecklists({ api = checklistsApi } = {}) {
  const checklists = ref([])
  const activeChecklist = ref(null)
  const state = ref('loading')
  const errorMessage = ref('')
  const showArchived = ref(false)
  const searchQuery = ref('')
  const isOpening = ref(false)
  const isSaving = ref(false)
  const saveError = ref('')
  const templates = ref([])

  let saveTimer = null
  let saveToken = 0

  // Archived checklists are always fetched so toggling the switch is a client-side filter,
  // never a refetch. Search scans title, description, and tags case-insensitively.
  const filteredChecklists = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return checklists.value.filter((checklist) => {
      if (!showArchived.value && checklist.is_archived) return false
      if (!query) return true
      const haystack = [checklist.title || '', checklist.description || '', ...(checklist.tags || [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })

  // When "move completed to bottom" is on, incomplete items lead while each group keeps its
  // own order. This is the order shown to the user and the order sent on save.
  const displayItems = computed(() => {
    const items = activeChecklist.value?.items || []
    if (!activeChecklist.value?.move_completed_to_bottom) return items
    const incomplete = items.filter((item) => !item.is_completed)
    const complete = items.filter((item) => item.is_completed)
    return [...incomplete, ...complete]
  })

  const progress = computed(() => {
    const items = activeChecklist.value?.items || []
    const total = items.length
    const completed = items.filter((item) => item.is_completed).length
    const percent = total ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  })

  async function loadList() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const rows = await api.listChecklists(1)
      checklists.value = Array.isArray(rows) ? rows : []
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your checklists could not be loaded.')
    }
  }

  async function openChecklist(name) {
    if (!name) return
    isOpening.value = true
    saveError.value = ''
    try {
      const checklist = await api.getChecklist(name)
      activeChecklist.value = normalizeChecklist(checklist)
    } catch (error) {
      saveError.value = readError(error, 'This checklist could not be opened.')
    } finally {
      isOpening.value = false
    }
  }

  function closeActive() {
    activeChecklist.value = null
  }

  // Persist a blank checklist, then open it so the user starts editing immediately.
  async function createChecklist() {
    saveError.value = ''
    try {
      const created = await api.saveChecklist({
        title: 'Untitled checklist',
        description: '',
        due_date: null,
        is_pinned: false,
        is_archived: false,
        move_completed_to_bottom: true,
        tags: [],
        items: [],
      })
      activeChecklist.value = normalizeChecklist(created)
      syncSummary(created)
    } catch (error) {
      saveError.value = readError(error, 'A new checklist could not be created.')
    }
  }

  async function deleteActive() {
    const list = activeChecklist.value
    if (!list?.name) return
    try {
      await api.deleteChecklist(list.name)
      checklists.value = checklists.value.filter((checklist) => checklist.name !== list.name)
      activeChecklist.value = null
    } catch (error) {
      saveError.value = readError(error, 'This checklist could not be deleted.')
    }
  }

  async function duplicateActive() {
    const list = activeChecklist.value
    if (!list?.name) return
    try {
      const copy = await api.duplicateChecklist(list.name)
      activeChecklist.value = normalizeChecklist(copy)
      syncSummary(copy)
    } catch (error) {
      saveError.value = readError(error, 'This checklist could not be duplicated.')
    }
  }

  function togglePin() {
    if (!activeChecklist.value) return
    activeChecklist.value.is_pinned = !activeChecklist.value.is_pinned
    save()
  }

  function toggleArchive() {
    if (!activeChecklist.value) return
    activeChecklist.value.is_archived = !activeChecklist.value.is_archived
    save()
  }

  function setMoveCompletedToBottom(value) {
    if (!activeChecklist.value) return
    activeChecklist.value.move_completed_to_bottom = Boolean(value)
    save()
  }

  function setTitle(text) {
    if (!activeChecklist.value) return
    activeChecklist.value.title = text
    scheduleSave()
  }

  function setDescription(text) {
    if (!activeChecklist.value) return
    activeChecklist.value.description = text
    scheduleSave()
  }

  function setDueDate(value) {
    if (!activeChecklist.value) return
    activeChecklist.value.due_date = value || null
    save()
  }

  function setTags(tags) {
    if (!activeChecklist.value) return
    activeChecklist.value.tags = Array.isArray(tags) ? [...tags] : []
    save()
  }

  function addItem(text) {
    const value = (text || '').trim()
    if (!value || !activeChecklist.value) return
    activeChecklist.value.items.push({
      item_text: value,
      is_completed: false,
      completed_at: null,
      note: null,
    })
    save()
  }

  function updateItemText(index, text) {
    const item = displayItems.value[index]
    if (!item) return
    item.item_text = text
    scheduleSave()
  }

  function removeItem(index) {
    const item = displayItems.value[index]
    const list = activeChecklist.value
    if (!item || !list) return
    const rawIndex = list.items.indexOf(item)
    if (rawIndex === -1) return
    list.items.splice(rawIndex, 1)
    save()
  }

  function toggleItem(index) {
    const item = displayItems.value[index]
    if (!item) return
    item.is_completed = !item.is_completed
    item.completed_at = item.is_completed ? new Date().toISOString() : null
    save()
  }

  // Non-drag reorder: swap the visible item with its neighbour in the raw array so the
  // displayed order changes by one step in the requested direction.
  function moveItem(index, dir) {
    const list = activeChecklist.value
    if (!list) return
    const order = displayItems.value
    const target = index + dir
    if (target < 0 || target >= order.length) return
    const items = [...list.items]
    const from = items.indexOf(order[index])
    const to = items.indexOf(order[target])
    if (from === -1 || to === -1) return
    ;[items[from], items[to]] = [items[to], items[from]]
    list.items = items
    save()
  }

  function clearCompleted() {
    const list = activeChecklist.value
    if (!list) return
    list.items = list.items.filter((item) => !item.is_completed)
    save()
  }

  function resetAll() {
    const list = activeChecklist.value
    if (!list) return
    for (const item of list.items) {
      item.is_completed = false
      item.completed_at = null
    }
    save()
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void save()
    }, SAVE_DEBOUNCE_MS)
  }

  // Persist the active checklist. A failed save keeps every local edit and only reports the
  // error, so the user never loses work. Stale saves never overwrite a newer one.
  async function save() {
    clearTimeout(saveTimer)
    saveTimer = null
    const list = activeChecklist.value
    if (!list) return
    const payload = buildPayload(list)
    const token = ++saveToken
    isSaving.value = true
    saveError.value = ''
    try {
      const saved = await api.saveChecklist(payload)
      if (token === saveToken) {
        if (activeChecklist.value?.name === saved.name) activeChecklist.value.modified = saved.modified
        syncSummary(saved)
      }
    } catch (error) {
      saveError.value = readError(error, 'Your changes could not be saved. They are still here — try again.')
    } finally {
      if (token === saveToken) isSaving.value = false
    }
  }

  // Load the system + personal templates once, on demand (when the picker opens).
  async function loadTemplates() {
    try {
      const rows = await api.listTemplates()
      templates.value = Array.isArray(rows) ? rows : []
    } catch (error) {
      saveError.value = readError(error, 'Templates could not be loaded.')
    }
  }

  // Create a checklist from a template and open it for editing.
  async function createFromTemplate(template) {
    saveError.value = ''
    try {
      const created = await api.createChecklistFromTemplate(template)
      activeChecklist.value = normalizeChecklist(created)
      syncSummary(created)
    } catch (error) {
      saveError.value = readError(error, 'A checklist could not be created from that template.')
    }
  }

  // Save the active checklist's items as a new personal template.
  async function saveActiveAsTemplate(templateName) {
    const list = activeChecklist.value
    if (!list?.name) return null
    saveError.value = ''
    try {
      const saved = await api.saveAsTemplate(list.name, templateName || list.title)
      await loadTemplates()
      return saved
    } catch (error) {
      saveError.value = readError(error, 'This checklist could not be saved as a template.')
      return null
    }
  }

  function exportMarkdown() {
    const list = activeChecklist.value
    if (!list) return false
    const lines = [`# ${list.title || 'Untitled checklist'}`, '']
    for (const item of displayItems.value) {
      lines.push(`- [${item.is_completed ? 'x' : ' '}] ${item.item_text}`)
    }
    return downloadTextFile(`${fileSlug(list.title)}.md`, `${lines.join('\n')}\n`, 'text/markdown')
  }

  function exportJson() {
    const list = activeChecklist.value
    if (!list) return false
    return downloadJson(`${fileSlug(list.title)}.json`, list)
  }

  function buildPayload(list) {
    return {
      name: list.name,
      title: list.title,
      description: list.description || '',
      due_date: list.due_date || null,
      is_pinned: list.is_pinned,
      is_archived: list.is_archived,
      move_completed_to_bottom: list.move_completed_to_bottom,
      tags: list.tags || [],
      items: displayItems.value.map((item) => ({
        item_text: item.item_text,
        is_completed: item.is_completed,
        note: item.note || null,
      })),
    }
  }

  // Replace (or insert) the summary row for a saved checklist from the authoritative server
  // response, so the list reflects new counts, title, pin, and archive state without a refetch.
  function syncSummary(saved) {
    const summary = {
      name: saved.name,
      title: saved.title,
      description: saved.description,
      due_date: saved.due_date,
      is_pinned: saved.is_pinned,
      is_archived: saved.is_archived,
      tags: Array.isArray(saved.tags) ? saved.tags : [],
      modified: saved.modified,
      total_items: saved.items.length,
      completed_items: saved.items.filter((item) => item.is_completed).length,
    }
    const index = checklists.value.findIndex((checklist) => checklist.name === saved.name)
    if (index === -1) checklists.value = [summary, ...checklists.value]
    else checklists.value.splice(index, 1, summary)
  }

  return {
    checklists,
    activeChecklist,
    state,
    errorMessage,
    showArchived,
    searchQuery,
    isOpening,
    isSaving,
    saveError,
    filteredChecklists,
    displayItems,
    progress,
    loadList,
    openChecklist,
    closeActive,
    createChecklist,
    deleteActive,
    duplicateActive,
    togglePin,
    toggleArchive,
    setMoveCompletedToBottom,
    setTitle,
    setDescription,
    setDueDate,
    setTags,
    addItem,
    updateItemText,
    removeItem,
    toggleItem,
    moveItem,
    clearCompleted,
    resetAll,
    save,
    exportMarkdown,
    exportJson,
    templates,
    loadTemplates,
    createFromTemplate,
    saveActiveAsTemplate,
  }
}

function normalizeChecklist(raw) {
  if (!raw) return null
  return {
    name: raw.name,
    title: raw.title || '',
    description: raw.description || '',
    due_date: raw.due_date || null,
    is_pinned: Boolean(raw.is_pinned),
    is_archived: Boolean(raw.is_archived),
    move_completed_to_bottom: raw.move_completed_to_bottom !== false,
    source_template: raw.source_template || null,
    tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
    items: Array.isArray(raw.items)
      ? raw.items.map((item) => ({
          item_text: item.item_text || '',
          is_completed: Boolean(item.is_completed),
          completed_at: item.completed_at || null,
          note: item.note || null,
        }))
      : [],
    creation: raw.creation || null,
    modified: raw.modified || null,
  }
}

function fileSlug(title) {
  const slug = (title || 'checklist')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'checklist'
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
