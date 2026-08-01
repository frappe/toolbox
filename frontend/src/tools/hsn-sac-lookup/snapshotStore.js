export const HSN_SNAPSHOT_SCHEMA_VERSION = 1
export const HSN_SOURCE_URL =
  'https://github.com/resilient-tech/india-compliance/tree/develop/india_compliance/gst_india/doctype/gst_hsn_code'

const DATABASE_NAME = 'toolbox-data'
const STORE_NAME = 'snapshots'
const SNAPSHOT_KEY = 'hsn-sac-catalog'
const MAX_RECORDS = 25_000
const REVISION_PATTERN = /^[a-f0-9]{64}$/
const CODE_PATTERN = /^\d{2,12}$/

export function createHsnSnapshotStore(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return createUnavailableStore()
  return {
    async load() {
      try {
        const snapshot = await transact(indexedDb, 'readonly', (store) => store.get(SNAPSHOT_KEY))
        return validHsnSnapshot(snapshot) ? snapshot : null
      } catch {
        return null
      }
    },
    async save(catalog, now = () => new Date()) {
      const snapshot = createHsnSnapshot(catalog, now)
      if (!snapshot) return null
      try {
        await transact(indexedDb, 'readwrite', (store) => store.put(snapshot, SNAPSHOT_KEY))
        return snapshot
      } catch {
        return null
      }
    },
  }
}

export function createHsnSnapshot(catalog, now = () => new Date()) {
  const snapshot = {
    schemaVersion: HSN_SNAPSHOT_SCHEMA_VERSION,
    snapshotRefreshedAt: now().toISOString(),
    data: catalog,
  }
  return validHsnSnapshot(snapshot) ? snapshot : null
}

export function validHsnSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== HSN_SNAPSHOT_SCHEMA_VERSION) return false
  if (!isIsoTimestamp(snapshot.snapshotRefreshedAt)) return false
  const data = snapshot.data
  if (!data || data.schemaVersion !== 1 || !REVISION_PATTERN.test(data.revision)) return false
  if (typeof data.sourceVersion !== 'string' || data.sourceVersion.length > 80) return false
  if (!isIsoTimestamp(data.sourceModifiedAt)) return false
  if (!Array.isArray(data.records) || data.records.length !== data.recordCount) return false
  if (data.records.length < 1 || data.records.length > MAX_RECORDS) return false
  if (data.source?.url !== HSN_SOURCE_URL) return false
  return data.records.every(validRecord)
}

function validRecord(record) {
  const baseValid =
    record &&
    CODE_PATTERN.test(record.code) &&
    typeof record.description === 'string' &&
    record.description.length > 0 &&
    record.description.length <= 2_000
  if (!baseValid) return false
  if ('gstRate' in record && (!Number.isFinite(record.gstRate) || record.gstRate < 0 || record.gstRate > 100)) {
    return false
  }
  return true
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function createUnavailableStore() {
  return { load: async () => null, save: async () => null }
}

function transact(indexedDb, mode, operation) {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDb.open(DATABASE_NAME, 1)
    openRequest.onupgradeneeded = () => {
      if (!openRequest.result.objectStoreNames.contains(STORE_NAME)) {
        openRequest.result.createObjectStore(STORE_NAME)
      }
    }
    openRequest.onerror = () => reject(openRequest.error)
    openRequest.onblocked = () => reject(new Error('The Toolbox data store is blocked.'))
    openRequest.onsuccess = () => {
      const database = openRequest.result
      const transaction = database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      let result
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        result = request.result
      }
      transaction.oncomplete = () => {
        database.close()
        resolve(result)
      }
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    }
  })
}
