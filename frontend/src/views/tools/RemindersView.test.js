import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import RemindersView from '@/views/tools/RemindersView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  listReminders: vi.fn(),
  getReminder: vi.fn(),
  saveReminder: vi.fn(),
  deleteReminder: vi.fn(),
  completeReminder: vi.fn(),
  snoozeReminder: vi.fn(),
  listDue: vi.fn(),
  acknowledge: vi.fn(),
}))

vi.mock('@/tools/reminders/api', () => api)

const rows = [
  {
    name: 'r1',
    title: 'Pay rent',
    note: '',
    time_zone: 'UTC',
    repeat_type: 'Monthly',
    repeat_interval: 1,
    status: 'Scheduled',
    tags: ['home'],
    next_trigger: '2999-01-01T09:00:00Z',
    snoozed_until: null,
    last_triggered: null,
  },
  {
    name: 'r2',
    title: 'Renew passport',
    note: '',
    time_zone: 'UTC',
    repeat_type: 'None',
    repeat_interval: 1,
    status: 'Scheduled',
    tags: [],
    next_trigger: '2020-01-01T09:00:00Z',
    snoozed_until: null,
    last_triggered: null,
  },
]

const dueRows = [
  {
    name: 'd1',
    reminder: 'r1',
    reminder_title: 'Stand up meeting',
    scheduled_for: '2024-01-01T09:00:00Z',
    note: 'Daily sync',
  },
]

async function mountView() {
  const wrapper = mount(RemindersView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('RemindersView', () => {
  it('records recent use and shows a friendly empty state with no reminders', async () => {
    api.listReminders.mockResolvedValue([])
    api.listDue.mockResolvedValue([])
    const wrapper = await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('reminders')
    expect(wrapper.text()).toContain('No reminders yet')
    expect(wrapper.findAll('button').some((button) => button.text() === 'New reminder')).toBe(true)
  })

  it('renders reminder rows grouped from a loaded list', async () => {
    api.listReminders.mockResolvedValue(rows)
    api.listDue.mockResolvedValue([])
    const wrapper = await mountView()

    expect(wrapper.get('[data-reminder-name="r1"]').text()).toContain('Pay rent')
    expect(wrapper.get('[data-reminder-name="r1"]').text()).toContain('home')
    expect(wrapper.get('[data-reminder-name="r2"]').text()).toContain('Renew passport')
  })

  it('opens the form when New reminder is clicked', async () => {
    api.listReminders.mockResolvedValue([])
    api.listDue.mockResolvedValue([])
    const wrapper = await mountView()

    const newButton = wrapper.findAll('button').find((button) => button.text() === 'New reminder')
    await newButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('#reminder-title').exists()).toBe(true)
  })

  it('renders the due-now inbox when a delivery is due', async () => {
    api.listReminders.mockResolvedValue([])
    api.listDue.mockResolvedValue(dueRows)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Due now')
    expect(wrapper.text()).toContain('Stand up meeting')
  })
})
