import { computed, ref } from 'vue'

import * as audioApi from './api'

// Owns the saved-recordings side of Audio: loading, saving a captured blob, rename, delete.
// The blob→base64 step is here so the view just hands over a Blob. Tests inject a fake api and
// a fake blob reader.
export function useAudioLibrary({ api = audioApi, readBlob = blobToBase64 } = {}) {
  const recordings = ref([])
  const state = ref('loading')
  const errorMessage = ref('')
  const isSaving = ref(false)
  const saveError = ref('')

  const isEmpty = computed(() => recordings.value.length === 0)

  async function load() {
    state.value = 'loading'
    errorMessage.value = ''
    try {
      const rows = await api.listRecordings()
      recordings.value = Array.isArray(rows) ? rows : []
      state.value = 'ready'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = readError(error, 'Your recordings could not be loaded.')
    }
  }

  // Persist a captured Blob with a title/duration. Returns the saved record or null on failure.
  async function saveBlob(blob, { title, durationSeconds = 0, category = '', tags = [], sourceType = 'Recording' } = {}) {
    if (!blob || !blob.size) {
      saveError.value = 'There is nothing recorded to save.'
      return null
    }
    isSaving.value = true
    saveError.value = ''
    try {
      const data = await readBlob(blob)
      const saved = await api.saveRecording({
        title: (title || '').trim() || 'Recording',
        data,
        duration_seconds: durationSeconds,
        category,
        tags,
        source_type: sourceType,
      })
      recordings.value = [saved, ...recordings.value]
      return saved
    } catch (error) {
      saveError.value = readError(error, 'This recording could not be saved.')
      return null
    } finally {
      isSaving.value = false
    }
  }

  async function rename(name, title) {
    try {
      const updated = await api.updateRecording({ name, title })
      replace(updated)
    } catch (error) {
      saveError.value = readError(error, 'This recording could not be updated.')
    }
  }

  async function remove(name) {
    try {
      await api.deleteRecording(name)
      recordings.value = recordings.value.filter((r) => r.name !== name)
    } catch (error) {
      saveError.value = readError(error, 'This recording could not be deleted.')
    }
  }

  function replace(saved) {
    const index = recordings.value.findIndex((r) => r.name === saved.name)
    if (index !== -1) recordings.value.splice(index, 1, saved)
  }

  return {
    recordings,
    state,
    errorMessage,
    isSaving,
    saveError,
    isEmpty,
    load,
    saveBlob,
    rename,
    remove,
  }
}

// Read a Blob as a base64 data URL (the server accepts and strips the data: prefix).
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Could not read the recording.'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function formatSize(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function readError(error, fallback) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || fallback
}
