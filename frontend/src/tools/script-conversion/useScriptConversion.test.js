import { describe, expect, it, vi } from 'vitest'

import { useScriptConversion } from './useScriptConversion'

vi.mock('@/utils/fileExport', () => ({ downloadTextFile: vi.fn(() => true) }))

describe('useScriptConversion', () => {
  it('produces converted output reactively from the input and schemes', () => {
    const t = useScriptConversion()
    t.source.value = 'itrans'
    t.target.value = 'devanagari'
    t.input.value = 'namaste'
    expect(t.output.value).toBe('नमस्ते')
    expect(t.inputCount.value).toBe(7)
  })

  it('swaps schemes and carries the output back into the input', () => {
    const t = useScriptConversion()
    t.source.value = 'itrans'
    t.target.value = 'devanagari'
    t.input.value = 'namaste'
    const converted = t.output.value
    t.swap()
    expect(t.source.value).toBe('devanagari')
    expect(t.target.value).toBe('itrans')
    expect(t.input.value).toBe(converted)
  })

  it('detects the source script of the input', () => {
    const t = useScriptConversion()
    t.input.value = 'नमस्ते'
    expect(t.detect()).toBe('devanagari')
    expect(t.source.value).toBe('devanagari')
  })

  it('clears the input', () => {
    const t = useScriptConversion()
    t.input.value = 'abc'
    t.clear()
    expect(t.input.value).toBe('')
  })

  it('copies output to the clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const t = useScriptConversion()
    t.source.value = 'itrans'
    t.target.value = 'devanagari'
    t.input.value = 'namaste'
    expect(await t.copyOutput()).toBe(true)
    expect(writeText).toHaveBeenCalledWith('नमस्ते')
    expect(t.copied.value).toBe(true)
    vi.unstubAllGlobals()
  })

  it('downloads the output as a text file', async () => {
    const { downloadTextFile } = await import('@/utils/fileExport')
    const t = useScriptConversion()
    t.source.value = 'itrans'
    t.target.value = 'devanagari'
    t.input.value = 'namaste'
    t.downloadOutput()
    expect(downloadTextFile).toHaveBeenCalled()
  })
})
