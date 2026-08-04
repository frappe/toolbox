import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadJson, downloadTextFile } from './fileExport'

describe('fileExport', () => {
  let createObjectURL
  let revokeObjectURL
  let clickSpy
  let clickedAnchor

  beforeEach(() => {
    clickedAnchor = null
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
    // jsdom anchors do not navigate; capture the element that was clicked.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockClick() {
        clickedAnchor = this
      })
  })

  afterEach(() => {
    delete globalThis.URL.createObjectURL
    delete globalThis.URL.revokeObjectURL
    vi.restoreAllMocks()
  })

  it('builds a typed blob, clicks a download anchor, and revokes the url', async () => {
    const result = downloadTextFile('notes.md', '# Hello', 'text/markdown')

    expect(result).toBe(true)
    expect(createObjectURL).toHaveBeenCalledTimes(1)

    const blob = createObjectURL.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown')
    expect(await blob.text()).toBe('# Hello')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(clickedAnchor.download).toBe('notes.md')
    expect(clickedAnchor.getAttribute('href')).toBe('blob:mock-url')

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('defaults the mime type to text/plain', () => {
    downloadTextFile('a.txt', 'hi')
    expect(createObjectURL.mock.calls[0][0].type).toBe('text/plain')
  })

  it('serializes JSON with a two-space indent and application/json', async () => {
    downloadJson('data.json', { b: 2, a: [1, 2] })

    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe('{\n  "b": 2,\n  "a": [\n    1,\n    2\n  ]\n}')
    expect(clickedAnchor.download).toBe('data.json')
  })

  it('no-ops safely when createObjectURL is unavailable', () => {
    globalThis.URL.createObjectURL = undefined

    expect(downloadTextFile('x.txt', 'x')).toBe(false)
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
