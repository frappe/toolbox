import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { DARK_MEDIA_QUERY, ThemeController } from './useTheme'

function makeMatchMedia(matches) {
  const listeners = new Set()
  const mql = {
    matches,
    addEventListener: (_event, cb) => listeners.add(cb),
    removeEventListener: (_event, cb) => listeners.delete(cb),
    emit(next) {
      this.matches = next
      listeners.forEach((cb) => cb())
    },
    get listenerCount() {
      return listeners.size
    },
  }
  const fn = vi.fn(() => mql)
  fn.mql = mql
  return fn
}

function setup(theme, systemDark = false) {
  const store = reactive({ settings: { theme } })
  const root = { dataset: {} }
  const matchMedia = makeMatchMedia(systemDark)
  const controller = new ThemeController({ store, root, matchMedia })
  return { store, root, matchMedia, controller }
}

describe('ThemeController', () => {
  it('applies an explicit light or dark theme directly', () => {
    const { root, controller } = setup('dark')
    controller.start()
    expect(root.dataset.theme).toBe('dark')
    controller.stop()
  })

  it('resolves the system theme from the OS colour scheme', () => {
    const { root, matchMedia, controller } = setup('system', true)
    controller.start()
    expect(matchMedia).toHaveBeenCalledWith(DARK_MEDIA_QUERY)
    expect(root.dataset.theme).toBe('dark')
    controller.stop()
  })

  it('reacts when the saved theme preference changes', async () => {
    const { store, root, controller } = setup('light')
    controller.start()
    expect(root.dataset.theme).toBe('light')
    store.settings.theme = 'dark'
    await nextTick()
    expect(root.dataset.theme).toBe('dark')
    controller.stop()
  })

  it('follows live system changes only while in system mode, then unsubscribes', async () => {
    const { store, root, matchMedia, controller } = setup('system', false)
    controller.start()
    expect(root.dataset.theme).toBe('light')
    matchMedia.mql.emit(true)
    expect(root.dataset.theme).toBe('dark')

    store.settings.theme = 'light'
    await nextTick()
    expect(root.dataset.theme).toBe('light')
    expect(matchMedia.mql.listenerCount).toBe(0)
    matchMedia.mql.emit(true) // ignored now — preference is explicit
    expect(root.dataset.theme).toBe('light')
    controller.stop()
    expect(matchMedia.mql.listenerCount).toBe(0)
  })

  it('is safe when the document or matchMedia is unavailable', () => {
    const store = reactive({ settings: { theme: 'system' } })
    const controller = new ThemeController({ store, root: null, matchMedia: null })
    expect(() => {
      controller.start()
      controller.stop()
    }).not.toThrow()
  })
})
