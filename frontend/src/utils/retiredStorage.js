// Tool history and the dictionary's recent searches were removed in #281. Both wrote to
// sessionStorage, so a visitor who is mid-session when the new build arrives still carries the
// keys. Nothing reads them any more, but leaving a log of what somebody calculated in their
// browser after the feature that justified it is gone is the wrong default.
//
// Delete this once a release has been out long enough that no live session predates it. The
// keys die with the tab regardless; this only shortens the window.

const RETIRED_PREFIX = 'toolbox:history:'
const RETIRED_KEYS = ['toolbox:calculator-history:v1', 'toolbox:dictionary-recent:v1']

export function clearRetiredStorage(storage = globalThis.sessionStorage) {
  if (!storage) return

  try {
    // The per-tool keys are built at runtime as `toolbox:history:<toolId>:v1`, and the financial
    // calculators prefixed their own ids again, so the list is read off the storage rather than
    // rebuilt from the registry — a registry that no longer names every tool that once wrote one.
    const staleKeys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(RETIRED_PREFIX)) staleKeys.push(key)
    }

    for (const key of [...staleKeys, ...RETIRED_KEYS]) storage.removeItem(key)
  } catch {
    // A browser that blocks storage has nothing to clear.
  }
}
