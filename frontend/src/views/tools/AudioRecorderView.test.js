import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AudioRecorderView from '@/views/tools/AudioRecorderView.vue'
import { takeRecording } from '@/tools/audio-recorder/recordingHandoff'

const preferences = vi.hoisted(() => ({
  isFavourite: vi.fn(() => false),
  toggleFavourite: vi.fn(),
  recordRecent: vi.fn(),
}))

vi.mock('@/composables/useToolboxPreferences', () => ({
  useToolboxPreferences: () => preferences,
}))

const push = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

async function mountView() {
  const wrapper = mount(AudioRecorderView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  takeRecording()
  vi.clearAllMocks()
})

describe('AudioRecorderView', () => {
  it('records recent use on mount', async () => {
    await mountView()

    expect(preferences.recordRecent).toHaveBeenCalledWith('audio-recorder')
  })

  it('notes when recording is unsupported (no MediaRecorder in the test env)', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('microphone support')
  })

  // The saved-recordings library is gone with the server. Nothing in the view may suggest that a
  // recording outlives the tab, because nothing does.
  it('makes no claim of a saved library', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).not.toContain('Saved recordings')
    expect(wrapper.text()).not.toContain('library')
    expect(wrapper.text()).toContain('Nothing is uploaded')
  })
})
