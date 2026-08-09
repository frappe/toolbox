import { describe, expect, it, vi } from 'vitest'

import { chooseFileSink, isFileSinkSupported, suggestedFileName } from './fileSink'

describe('isFileSinkSupported', () => {
  it('is true only where the picker exists', () => {
    expect(isFileSinkSupported({ showSaveFilePicker: () => {} })).toBe(true)
    expect(isFileSinkSupported({})).toBe(false)
    expect(isFileSinkSupported(undefined)).toBe(false)
  })
})

describe('suggestedFileName', () => {
  const at = new Date('2026-08-09T14:32:07Z')

  it('names the file by container, with a sortable stamp', () => {
    expect(suggestedFileName('audio/webm;codecs=opus', at)).toBe('recording-2026-08-09-14-32-07.webm')
    expect(suggestedFileName('audio/mp4', at)).toBe('recording-2026-08-09-14-32-07.m4a')
    expect(suggestedFileName('audio/ogg;codecs=opus', at)).toBe('recording-2026-08-09-14-32-07.ogg')
  })

  it('falls back to webm for an unknown or absent type', () => {
    expect(suggestedFileName('', at)).toBe('recording-2026-08-09-14-32-07.webm')
  })
})

describe('chooseFileSink', () => {
  it('returns a writable stream for the chosen file', async () => {
    const writable = { write: vi.fn(), close: vi.fn() }
    const scope = {
      showSaveFilePicker: vi.fn(async () => ({ createWritable: async () => writable })),
    }

    await expect(chooseFileSink({ mimeType: 'audio/webm', scope })).resolves.toBe(writable)
    expect(scope.showSaveFilePicker).toHaveBeenCalledOnce()
  })

  it('returns null when the visitor cancels, because that is not an error', async () => {
    const scope = {
      showSaveFilePicker: vi.fn(async () => {
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      }),
    }

    await expect(chooseFileSink({ scope })).resolves.toBe(null)
  })

  it('returns null where the API is absent, so callers fall back to memory', async () => {
    await expect(chooseFileSink({ scope: {} })).resolves.toBe(null)
  })

  it('rethrows a real failure', async () => {
    const scope = {
      showSaveFilePicker: vi.fn(async () => {
        throw new Error('disk on fire')
      }),
    }

    await expect(chooseFileSink({ scope })).rejects.toThrow('disk on fire')
  })
})
