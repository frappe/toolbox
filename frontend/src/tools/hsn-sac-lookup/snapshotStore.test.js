import { describe, expect, it } from 'vitest'

import {
  createHsnSnapshot,
  HSN_SOURCE_URL,
  HSN_SNAPSHOT_SCHEMA_VERSION,
  validHsnSnapshot,
} from './snapshotStore'

const catalog = {
  schemaVersion: 1,
  revision: 'a'.repeat(64),
  sourceVersion: '17.1.0',
  sourceModifiedAt: '2026-07-31T12:00:00+00:00',
  recordCount: 1,
  records: [
    {
      code: '0101',
      description: 'Live horses',
    },
  ],
  source: { name: 'India Compliance GST HSN Code', url: HSN_SOURCE_URL },
}

describe('HSN browser snapshot validation', () => {
  it('creates a versioned snapshot with a separate refresh time', () => {
    const snapshot = createHsnSnapshot(catalog, () => new Date('2026-08-01T01:00:00Z'))

    expect(snapshot.schemaVersion).toBe(HSN_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.snapshotRefreshedAt).toBe('2026-08-01T01:00:00.000Z')
    expect(snapshot.data.sourceModifiedAt).toBe('2026-07-31T12:00:00+00:00')
  })

  it('rejects unsafe sources, mismatched counts, and invalid records', () => {
    const snapshot = createHsnSnapshot(catalog)
    expect(validHsnSnapshot({ ...snapshot, data: { ...catalog, source: { url: 'https://evil.test' } } })).toBe(false)
    expect(validHsnSnapshot({ ...snapshot, data: { ...catalog, recordCount: 2 } })).toBe(false)
    expect(
      validHsnSnapshot({
        ...snapshot,
        data: { ...catalog, records: [{ ...catalog.records[0], code: '<script>' }] },
      }),
    ).toBe(false)
  })
})
