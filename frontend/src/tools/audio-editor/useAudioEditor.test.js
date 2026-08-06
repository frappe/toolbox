import { describe, expect, it, vi } from 'vitest'

import { useAudioEditor } from './useAudioEditor'

function fakeFile(name = 'clip.wav') {
  return { name, arrayBuffer: vi.fn(async () => new ArrayBuffer(8)) }
}

const decoded = { channels: [new Float32Array(1000).fill(0.5)], sampleRate: 1000, duration: 1 }

describe('useAudioEditor', () => {
  it('loads a file into a default whole-clip project', async () => {
    const editor = useAudioEditor({ decode: vi.fn(async () => decoded) })
    expect(await editor.load(fakeFile())).toBe(true)
    expect(editor.state.value).toBe('ready')
    expect(editor.project.value).toEqual({ trimStart: 0, trimEnd: 1, fadeIn: 0, fadeOut: 0, gainDb: 0 })
    expect(editor.peaks.value.length).toBe(800)
  })

  it('reports an error when decoding fails', async () => {
    const editor = useAudioEditor({ decode: vi.fn(async () => { throw new Error('bad') }) })
    expect(await editor.load(fakeFile())).toBe(false)
    expect(editor.state.value).toBe('error')
    expect(editor.error.value).toContain('could not be decoded')
  })

  it('undoes and redoes edits', async () => {
    const editor = useAudioEditor({ decode: vi.fn(async () => decoded) })
    await editor.load(fakeFile())
    expect(editor.canUndo.value).toBe(false)
    editor.update({ gainDb: -6 })
    expect(editor.project.value.gainDb).toBe(-6)
    expect(editor.canUndo.value).toBe(true)
    editor.undo()
    expect(editor.project.value.gainDb).toBe(0)
    expect(editor.canRedo.value).toBe(true)
    editor.redo()
    expect(editor.project.value.gainDb).toBe(-6)
  })

  it('renders the current edit to a WAV blob', async () => {
    const editor = useAudioEditor({ decode: vi.fn(async () => decoded) })
    await editor.load(fakeFile())
    editor.update({ trimStart: 0, trimEnd: 0.5 })
    const blob = editor.renderBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 500 * 2) // header + 500 frames, mono, 16-bit
    expect(editor.outputDuration.value).toBeCloseTo(0.5)
  })

  it('renders planar channels for non-WAV encoders', async () => {
    const editor = useAudioEditor({ decode: vi.fn(async () => decoded) })
    await editor.load(fakeFile())
    editor.update({ trimStart: 0, trimEnd: 0.5 })
    const planar = editor.renderPlanar()
    expect(planar.sampleRate).toBe(1000)
    expect(planar.channels[0].length).toBe(500)
  })
})
