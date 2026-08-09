import { describe, expect, it } from 'vitest'

import { formatDuration, formatSize } from './audioFormat'

describe('formatDuration', () => {
  it('renders minutes and zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7)).toBe('0:07')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('clamps junk and negatives to zero', () => {
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(undefined)).toBe('0:00')
    expect(formatDuration('abc')).toBe('0:00')
  })
})

describe('formatSize', () => {
  it('picks a unit by magnitude', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('treats junk as zero', () => {
    expect(formatSize(undefined)).toBe('0 B')
  })
})
