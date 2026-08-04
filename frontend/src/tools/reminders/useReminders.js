import { computed, ref } from 'vue'

import * as remindersApi from './api'
import { downloadJson, downloadTextFile } from '@/utils/fileExport'

// The composable owns reminder list state, the edit form, the in-app inbox, and the optional
// browser-notification enhancement, so the view stays a thin layer of markup. The real api
// module is the default; tests inject a fake with the same shape.
export function useReminders({ api = remindersApi } = {}) {
  const reminders = ref([])
  const dueList = ref([])
  const activeReminder = ref(null)
  const scope = ref('active')
  const state = ref('loading')
  const errorMessage = ref('')
  const searchQuery = ref('')
  const isSaving = ref(false)
  const saveError = ref('')
  const browserPermission = ref(readNotificationPermission())

  // Deliveries already surfaced as a browser notification, so refreshing the inbox never
  // re-notifies for the same occurrence.
  const notified = new Set()

  const filteredReminders = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return reminders.value
    return reminders.value.filter((reminder) => {
      const haystack = [reminder.title || '', reminder.note || '', ...(reminder.tags || [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  })

  // Active reminders are bucketed by when they next fire; completed reminders are one flat list.
  const sections = computed(() => {
    if (scope.value === 'completed') {
      return withItems([{ key: 'completed', label: 'Completed', items: filteredReminders.value }])
    }
    const now = new Date()
    const buckets = { overdue: [], today: [], upcoming: [] }
    for (const reminder of filteredReminders.value) {
      buckets[bucketFor(reminder.next_trigger, now)].push(reminder)
    }
    return withItems([
      { key: 'overdue', label: 'Overdue', items: buckets.overdue },
      { key: 'today', label: 'Today', items: buckets.today },
      { key: 'upcoming', label: 'Upcoming', items: buckets.upcoming },
    ])
  })

  const dueCount = computed(() => dueList.value.length)

  async function loadList() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const [rows] = await Promise.all([api.listReminders(scope.value), loadDue()])
      reminders.value = Array.isArray(rows) ? rows : []
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your reminders could not be loaded.')
    }
  }

  async function loadDue() {
    try {
      const rows = await api.listDue()
      dueList.value = Array.isArray(rows) ? rows : []
      maybeNotify(dueList.value)
    } catch {
      // The inbox is a secondary view; a failure here must not blank the whole page.
      dueList.value = []
    }
  }

  async function setScope(next) {
    if (next === scope.value) return
    scope.value = next
    activeReminder.value = null
    await loadList()
  }

  // Open a blank form with sensible defaults: today, the next whole hour, the browser's zone.
  function newReminder() {
    saveError.value = ''
    const start = nextHour(new Date())
    activeReminder.value = {
      name: null,
      title: '',
      note: '',
      local_date: toDateInput(start),
      local_time: toTimeInput(start),
      time_zone: browserTimeZone(),
      repeat_type: 'None',
      repeat_interval: 1,
      repeat_end_date: null,
      delivery_in_app: true,
      delivery_email: false,
      delivery_browser: false,
      tags: [],
    }
  }

  async function editReminder(name) {
    if (!name) return
    saveError.value = ''
    try {
      activeReminder.value = normalize(await api.getReminder(name))
    } catch (error) {
      saveError.value = readError(error, 'This reminder could not be opened.')
    }
  }

  function closeForm() {
    activeReminder.value = null
    saveError.value = ''
  }

  // Persist the form. A failed save keeps every field so the user never loses input.
  async function saveActive() {
    const reminder = activeReminder.value
    if (!reminder) return false
    if (!reminder.title.trim()) {
      saveError.value = 'Give the reminder a title.'
      return false
    }
    isSaving.value = true
    saveError.value = ''
    try {
      await api.saveReminder(buildPayload(reminder))
      activeReminder.value = null
      await loadList()
      return true
    } catch (error) {
      saveError.value = readError(error, 'Your reminder could not be saved. It is still here — try again.')
      return false
    } finally {
      isSaving.value = false
    }
  }

  async function removeReminder(name) {
    if (!name) return
    try {
      await api.deleteReminder(name)
      if (activeReminder.value?.name === name) activeReminder.value = null
      await loadList()
    } catch (error) {
      saveError.value = readError(error, 'This reminder could not be deleted.')
    }
  }

  async function complete(name) {
    if (!name) return
    try {
      await api.completeReminder(name)
      await loadList()
    } catch (error) {
      saveError.value = readError(error, 'This reminder could not be completed.')
    }
  }

  async function snooze(name, options) {
    if (!name) return
    try {
      await api.snoozeReminder(name, options)
      await loadList()
    } catch (error) {
      saveError.value = readError(error, 'This reminder could not be snoozed.')
    }
  }

  async function acknowledgeDue(deliveryName) {
    if (!deliveryName) return
    try {
      await api.acknowledge(deliveryName)
      await loadDue()
    } catch {
      // A failed dismiss is harmless; the item simply stays until the next refresh.
    }
  }

  async function enableBrowserNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      browserPermission.value = await window.Notification.requestPermission()
    } catch {
      browserPermission.value = readNotificationPermission()
    }
  }

  function exportJson() {
    return downloadJson('reminders.json', reminders.value)
  }

  function exportCsv() {
    const header = ['Title', 'Note', 'Next trigger', 'Repeat', 'Interval', 'Status', 'Tags']
    const rows = reminders.value.map((reminder) => [
      reminder.title || '',
      reminder.note || '',
      reminder.next_trigger || '',
      reminder.repeat_type || 'None',
      reminder.repeat_interval || 1,
      reminder.status || '',
      (reminder.tags || []).join(' '),
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    return downloadTextFile('reminders.csv', `${csv}\r\n`, 'text/csv')
  }

  function maybeNotify(items) {
    if (readNotificationPermission() !== 'granted') return
    for (const item of items) {
      if (notified.has(item.name)) continue
      notified.add(item.name)
      try {
        // eslint-disable-next-line no-new
        new window.Notification(item.reminder_title || 'Reminder', { body: item.note || '' })
      } catch {
        // Ignore environments that reject construction (e.g. without a service worker).
      }
    }
  }

  return {
    reminders,
    dueList,
    activeReminder,
    scope,
    state,
    errorMessage,
    searchQuery,
    isSaving,
    saveError,
    browserPermission,
    filteredReminders,
    sections,
    dueCount,
    loadList,
    loadDue,
    setScope,
    newReminder,
    editReminder,
    closeForm,
    saveActive,
    removeReminder,
    complete,
    snooze,
    acknowledgeDue,
    enableBrowserNotifications,
    exportJson,
    exportCsv,
  }
}

// Human-readable recurrence, e.g. "Every 2 weeks" or "Daily until 31 Dec 2026".
export function describeRepeat(reminder) {
  const type = reminder?.repeat_type || 'None'
  if (type === 'None') return 'Once'
  const interval = Math.max(Number(reminder.repeat_interval) || 1, 1)
  const unit = { Daily: 'day', Weekly: 'week', Monthly: 'month', Yearly: 'year' }[type]
  const base = interval === 1 ? capitalize(`${type}`) : `Every ${interval} ${unit}s`
  return reminder.repeat_end_date ? `${base} until ${formatDate(reminder.repeat_end_date)}` : base
}

// Format a UTC ISO instant in a named zone. Used to show when a reminder fires in its own zone.
export function formatInstant(iso, { timeZone, hour12 = true } = {}) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12,
      timeZone: timeZone || undefined,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

function normalize(raw) {
  if (!raw) return null
  return {
    name: raw.name,
    title: raw.title || '',
    note: raw.note || '',
    local_date: raw.local_date || toDateInput(new Date()),
    local_time: (raw.local_time || '09:00').slice(0, 5),
    time_zone: raw.time_zone || browserTimeZone(),
    repeat_type: raw.repeat_type || 'None',
    repeat_interval: Math.max(Number(raw.repeat_interval) || 1, 1),
    repeat_end_date: raw.repeat_end_date || null,
    delivery_in_app: raw.delivery_in_app !== false,
    delivery_email: Boolean(raw.delivery_email),
    delivery_browser: Boolean(raw.delivery_browser),
    tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
  }
}

function buildPayload(reminder) {
  return {
    name: reminder.name || undefined,
    title: reminder.title,
    note: reminder.note || '',
    local_date: reminder.local_date,
    local_time: reminder.local_time,
    time_zone: reminder.time_zone,
    repeat_type: reminder.repeat_type,
    repeat_interval: Math.max(Number(reminder.repeat_interval) || 1, 1),
    repeat_end_date: reminder.repeat_type === 'None' ? null : reminder.repeat_end_date || null,
    delivery_in_app: reminder.delivery_in_app,
    delivery_email: reminder.delivery_email,
    delivery_browser: reminder.delivery_browser,
    tags: reminder.tags || [],
  }
}

function bucketFor(iso, now) {
  if (!iso) return 'upcoming'
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return 'upcoming'
  if (when < now) return 'overdue'
  return isSameLocalDay(when, now) ? 'today' : 'upcoming'
}

function withItems(list) {
  return list.filter((section) => section.items.length)
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function nextHour(date) {
  const next = new Date(date)
  next.setHours(next.getHours() + 1, 0, 0, 0)
  return next
}

function toDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function readNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
