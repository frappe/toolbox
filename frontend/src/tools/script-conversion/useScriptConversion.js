import { computed, ref } from 'vue'

import { ALL_SCHEMES, convertScript, detectScript } from './scriptConversion'
import { downloadTextFile } from '@/utils/fileExport'

// Owns the Script Conversion tool state. Conversion is synchronous, deterministic and offline,
// so the output is a pure computed of the input and the two selected schemes.
export function useScriptConversion() {
  const source = ref('itrans')
  const target = ref('devanagari')
  const input = ref('')
  const copied = ref(false)

  const output = computed(() => convertScript(input.value, source.value, target.value))
  const inputCount = computed(() => input.value.length)
  const outputCount = computed(() => output.value.length)

  function setSource(scheme) {
    source.value = scheme
  }

  function setTarget(scheme) {
    target.value = scheme
  }

  // Swap the two schemes and carry the current output back into the input, so a converted
  // result can be round-tripped or corrected without retyping.
  function swap() {
    const previousOutput = output.value
    const previousSource = source.value
    source.value = target.value
    target.value = previousSource
    if (previousOutput) input.value = previousOutput
  }

  // Point the source selector at the detected script of the current input, when confident.
  function detect() {
    const detected = detectScript(input.value)
    if (detected && detected !== source.value) source.value = detected
    return detected
  }

  function clear() {
    input.value = ''
    copied.value = false
  }

  async function copyOutput() {
    const text = output.value
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return false
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      return true
    } catch {
      return false
    }
  }

  function downloadOutput() {
    if (!output.value) return false
    return downloadTextFile('script-conversion.txt', output.value, 'text/plain')
  }

  return {
    schemes: ALL_SCHEMES,
    source,
    target,
    input,
    output,
    inputCount,
    outputCount,
    copied,
    setSource,
    setTarget,
    swap,
    detect,
    clear,
    copyOutput,
    downloadOutput,
  }
}
