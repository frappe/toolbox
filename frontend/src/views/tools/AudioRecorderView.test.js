import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AudioRecorderView from '@/views/tools/AudioRecorderView.vue'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const api = vi.hoisted(() => ({
  listRecordings: vi.fn(),
  saveRecording: vi.fn(),
  updateRecording: vi.fn(),
  deleteRecording: vi.fn(),
}))

vi.mock('@/tools/audio-recorder/api', () => api)

async function mountView() {
  const wrapper = mount(AudioRecorderView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('AudioRecorderView', () => {
  it('records recent use and shows the empty library state', async () => {
    api.listRecordings.mockResolvedValue([])
    const wrapper = await mountView()
    expect(preferences.recordRecent).toHaveBeenCalledWith('audio-recorder')
    expect(wrapper.text()).toContain('Saved recordings')
    expect(wrapper.text()).toContain('No recordings yet')
  })

  it('notes when recording is unsupported (no MediaRecorder in the test env)', async () => {
    api.listRecordings.mockResolvedValue([])
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('microphone support')
  })

  it('renders a saved recording row', async () => {
    api.listRecordings.mockResolvedValue([
      { name: 'A1', title: 'Standup notes', duration_seconds: 42, file_size: 12345, container_format: 'webm', file: '/private/files/a.webm' },
    ])
    const wrapper = await mountView()
    expect(wrapper.get('[data-recording-name="A1"]').text()).toContain('Standup notes')
    expect(wrapper.get('[data-recording-name="A1"]').text()).toContain('0:42')
  })
})
