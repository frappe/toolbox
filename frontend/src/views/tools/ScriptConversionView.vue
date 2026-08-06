<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-languages" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Language</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Script Conversion</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Convert text between writing systems — it runs on your device and preserves pronunciation, not meaning.</p>
      </div>
    </header>

    <!-- Scheme controls -->
    <div class="mt-8 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div class="flex flex-col gap-1.5">
        <label for="source-scheme" class="text-sm font-medium text-ink-gray-7">From</label>
        <select id="source-scheme" v-model="tool.source.value" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
          <optgroup label="Scripts">
            <option v-for="s in scriptSchemes" :key="s.id" :value="s.id">{{ s.label }}{{ s.hint ? ` — ${s.hint}` : '' }}</option>
          </optgroup>
          <optgroup label="Roman">
            <option v-for="s in romanSchemes" :key="s.id" :value="s.id">{{ s.label }}{{ s.hint ? ` — ${s.hint}` : '' }}</option>
          </optgroup>
        </select>
      </div>

      <Button class="mb-0.5" variant="outline" icon="lucide-arrow-left-right" aria-label="Swap scripts" title="Swap scripts" @click="tool.swap()" />

      <div class="flex flex-col gap-1.5">
        <label for="target-scheme" class="text-sm font-medium text-ink-gray-7">To</label>
        <select id="target-scheme" v-model="tool.target.value" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
          <optgroup label="Scripts">
            <option v-for="s in scriptSchemes" :key="s.id" :value="s.id">{{ s.label }}{{ s.hint ? ` — ${s.hint}` : '' }}</option>
          </optgroup>
          <optgroup label="Roman">
            <option v-for="s in romanSchemes" :key="s.id" :value="s.id">{{ s.label }}{{ s.hint ? ` — ${s.hint}` : '' }}</option>
          </optgroup>
        </select>
      </div>
    </div>

    <!-- Text panes -->
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="source-text" class="text-sm font-medium text-ink-gray-7">Input</label>
          <div class="flex items-center gap-2">
            <Button variant="ghost" icon="lucide-wand-2" label="Detect script" @click="tool.detect()" />
            <span class="text-xs tabular-nums text-ink-gray-5">{{ tool.inputCount.value }}</span>
          </div>
        </div>
        <textarea id="source-text" v-model="tool.input.value" rows="10" dir="auto" spellcheck="false" placeholder="Type or paste text to convert…" class="w-full resize-y rounded-xl border border-outline-gray-2 bg-surface-base px-3 py-2 text-base leading-7 text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="target-text" class="text-sm font-medium text-ink-gray-7">Output</label>
          <span class="text-xs tabular-nums text-ink-gray-5">{{ tool.outputCount.value }}</span>
        </div>
        <textarea id="target-text" :value="tool.output.value" rows="10" dir="auto" readonly aria-label="Converted text" placeholder="Converted text appears here." class="w-full resize-y rounded-xl border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-base leading-7 text-ink-gray-9 outline-none" />
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="solid" :icon="tool.copied.value ? 'lucide-check' : 'lucide-copy'" :label="tool.copied.value ? 'Copied' : 'Copy output'" :disabled="!tool.output.value" @click="tool.copyOutput()" />
      <Button variant="outline" icon="lucide-download" label="Download .txt" :disabled="!tool.output.value" @click="tool.downloadOutput()" />
      <Button variant="ghost" icon="lucide-eraser" label="Clear" :disabled="!tool.input.value" @click="tool.clear()" />
      <p class="ml-auto text-xs text-ink-gray-5" role="note">Transliteration can have more than one valid form.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { ROMAN_SCHEMES, SCRIPT_SCHEMES } from '@/tools/script-conversion/scriptConversion'
import { useScriptConversion } from '@/tools/script-conversion/useScriptConversion'

const TOOL_ID = 'script-conversion'

const preferences = useToolboxPreferences()
const tool = useScriptConversion()

const scriptSchemes = SCRIPT_SCHEMES
const romanSchemes = ROMAN_SCHEMES

onMounted(() => preferences.recordRecent(TOOL_ID))
</script>
