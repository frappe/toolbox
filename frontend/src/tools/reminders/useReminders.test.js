import { afterEach, describe, expect, it, vi } from 'vitest'

import { describeRepeat, formatInstant, useReminders } from './useReminders'

vi.mock('@/utils/fileExport', () => ({
  downloadJson: vi.fn(() => true),
  downloadTextFile: vi.fn(() => true),
}))

function makeApi(overrides = {}) {
  return {
    listReminders: vi.fn(async () => []),
    getReminder: vi.fn(async () => ({})),
    saveReminder: vi.fn(async () => ({ name: 'R1' })),
    deleteReminder: vi.fn(async () => {}),
    completeReminder: vi.fn(async () => ({})),
    snoozeReminder: vi.fn(async () => ({})),
    listDue: vi.fn(async () => []),
    acknowledge: vi.fn(async () => {}),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useReminders', () => {
  it('loads reminders and the inbox, then reports ready', async () => {
    const due = [{ name: 'D1', reminder: 'R1', reminder_title: 'Call', scheduled_for: null, note: '' }]
    const api = makeApi({
      listReminders: vi.fn(async () => [{ name: 'R1', title: 'Call', tags: [] }]),
      listDue: vi.fn(async () => due),
    })
    const r = useReminders({ api })
    await r.loadList()

    expect(r.state.value).toBe('ready')
    expect(r.reminders.value).toHaveLength(1)
    expect(r.dueCount.value).toBe(1)
  })

  it('reports an error when the list cannot load', async () => {
    const api = makeApi({ listReminders: vi.fn(async () => { throw new Error('offline') }) })
    const r = useReminders({ api })
    await r.loadList()

    expect(r.state.value).toBe('error')
    expect(r.errorMessage.value).toBe('offline')
  })

  it('filters by title, note, and tags', async () => {
    const api = makeApi({
      listReminders: vi.fn(async () => [
        { name: 'A', title: 'Pay rent', note: '', tags: [] },
        { name: 'B', title: 'Gym', note: 'leg day', tags: ['health'] },
      ]),
    })
    const r = useReminders({ api })
    await r.loadList()

    r.searchQuery.value = 'leg'
    expect(r.filteredReminders.value.map((x) => x.name)).toEqual(['B'])
    r.searchQuery.value = 'health'
    expect(r.filteredReminders.value.map((x) => x.name)).toEqual(['B'])
  })

  it('buckets active reminders into overdue, today, and upcoming', async () => {
    vi.useFakeTimers()
    // Fix "now" to local noon so the offsets below stay on the expected local day in any zone.
    const now = new Date('2026-08-04T12:00:00')
    vi.setSystemTime(now)
    const at = (ms) => new Date(now.getTime() + ms).toISOString()
    const hour = 3600 * 1000
    const api = makeApi({
      listReminders: vi.fn(async () => [
        { name: 'past', title: 'Overdue', tags: [], next_trigger: at(-6 * hour) },
        { name: 'now', title: 'Today', tags: [], next_trigger: at(2 * hour) },
        { name: 'later', title: 'Upcoming', tags: [], next_trigger: at(5 * 24 * hour) },
      ]),
    })
    const r = useReminders({ api })
    await r.loadList()

    const keys = r.sections.value.map((s) => s.key)
    expect(keys).toEqual(['overdue', 'today', 'upcoming'])
    expect(r.sections.value.find((s) => s.key === 'today').items[0].name).toBe('now')
  })

  it('opens a blank form with browser defaults', () => {
    const r = useReminders({ api: makeApi() })
    r.newReminder()

    expect(r.activeReminder.value.name).toBeNull()
    expect(r.activeReminder.value.repeat_type).toBe('None')
    expect(r.activeReminder.value.delivery_in_app).toBe(true)
    expect(r.activeReminder.value.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(r.activeReminder.value.local_time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('refuses to save a reminder without a title', async () => {
    const api = makeApi()
    const r = useReminders({ api })
    r.newReminder()
    r.activeReminder.value.title = '   '

    expect(await r.saveActive()).toBe(false)
    expect(api.saveReminder).not.toHaveBeenCalled()
    expect(r.saveError.value).toContain('title')
  })

  it('saves a valid reminder, closes the form, and reloads', async () => {
    const api = makeApi()
    const r = useReminders({ api })
    r.newReminder()
    r.activeReminder.value.title = 'Water plants'

    expect(await r.saveActive()).toBe(true)
    expect(api.saveReminder).toHaveBeenCalledTimes(1)
    expect(api.saveReminder.mock.calls[0][0].title).toBe('Water plants')
    expect(r.activeReminder.value).toBeNull()
    expect(api.listReminders).toHaveBeenCalled()
  })

  it('keeps the form and its input when a save fails', async () => {
    const api = makeApi({ saveReminder: vi.fn(async () => { throw new Error('nope') }) })
    const r = useReminders({ api })
    r.newReminder()
    r.activeReminder.value.title = 'Keep me'

    expect(await r.saveActive()).toBe(false)
    expect(r.activeReminder.value.title).toBe('Keep me')
    expect(r.saveError.value).toBe('nope')
  })

  it('drops the end date when a reminder does not repeat', async () => {
    const api = makeApi()
    const r = useReminders({ api })
    r.newReminder()
    r.activeReminder.value.title = 'One off'
    r.activeReminder.value.repeat_type = 'None'
    r.activeReminder.value.repeat_end_date = '2026-12-31'
    await r.saveActive()

    expect(api.saveReminder.mock.calls[0][0].repeat_end_date).toBeNull()
  })

  it('completes, snoozes, and acknowledges through the api', async () => {
    const api = makeApi()
    const r = useReminders({ api })
    await r.complete('R1')
    await r.snooze('R1', { preset: '1h' })
    await r.acknowledgeDue('D1')

    expect(api.completeReminder).toHaveBeenCalledWith('R1')
    expect(api.snoozeReminder).toHaveBeenCalledWith('R1', { preset: '1h' })
    expect(api.acknowledge).toHaveBeenCalledWith('D1')
  })

  it('switches scope and reloads', async () => {
    const api = makeApi()
    const r = useReminders({ api })
    await r.setScope('completed')

    expect(r.scope.value).toBe('completed')
    expect(api.listReminders).toHaveBeenLastCalledWith('completed')
  })
})

describe('describeRepeat', () => {
  it('describes one-off and interval recurrences', () => {
    expect(describeRepeat({ repeat_type: 'None' })).toBe('Once')
    expect(describeRepeat({ repeat_type: 'Daily', repeat_interval: 1 })).toBe('Daily')
    expect(describeRepeat({ repeat_type: 'Weekly', repeat_interval: 2 })).toBe('Every 2 weeks')
  })

  it('appends the end date when present', () => {
    const text = describeRepeat({ repeat_type: 'Daily', repeat_interval: 1, repeat_end_date: '2026-12-31' })
    expect(text).toContain('Daily until')
  })
})

describe('formatInstant', () => {
  it('returns empty for a missing instant and a string otherwise', () => {
    expect(formatInstant(null)).toBe('')
    expect(typeof formatInstant('2026-08-04T09:00:00Z', { timeZone: 'UTC' })).toBe('string')
  })
})
