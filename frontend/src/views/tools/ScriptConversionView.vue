<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-languages"
      :category="categoryName"
      title="Script Conversion"
      description="Convert text between writing systems — it runs on your device and preserves pronunciation, not meaning."
    />

    <!-- Scheme controls -->
    <div class="mt-8 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <FormControl id="source-scheme" type="combobox" size="md" variant="outline" label="From" :options="schemeOptions" :model-value="tool.source.value" placeholder="Search a scheme" @update:model-value="tool.source.value = $event" />

      <Tooltip text="Swap scripts">
        <Button class="mb-0.5" variant="outline" icon="lucide-arrow-left-right" aria-label="Swap scripts" @click="tool.swap()" />
      </Tooltip>

      <FormControl id="target-scheme" type="combobox" size="md" variant="outline" label="To" :options="schemeOptions" :model-value="tool.target.value" placeholder="Search a scheme" @update:model-value="tool.target.value = $event" />
    </div>

    <!-- Text panes -->
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="flex flex-col gap-2">
        <div class="flex min-h-8 items-center justify-between">
          <label for="source-text" class="text-sm font-medium text-ink-gray-7">Input</label>
          <div class="flex items-center gap-2">
            <Button variant="ghost" icon-left="lucide-wand-2" label="Detect script" @click="tool.detect()" />
            <span class="text-xs tabular-nums text-ink-gray-5">{{ tool.inputCount.value }}</span>
          </div>
        </div>
        <FormControl id="source-text" type="textarea" size="md" variant="outline" class="[&_textarea]:resize-y [&_textarea]:leading-7" :rows="10" dir="auto" spellcheck="false" placeholder="Type or paste text to convert…" :model-value="tool.input.value" @update:model-value="tool.input.value = $event" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex min-h-8 items-center justify-between">
          <label for="target-text" class="text-sm font-medium text-ink-gray-7">Output</label>
          <span class="text-xs tabular-nums text-ink-gray-5">{{ tool.outputCount.value }}</span>
        </div>
        <FormControl id="target-text" type="textarea" size="md" variant="subtle" class="[&_textarea]:resize-y [&_textarea]:leading-7" :rows="10" dir="auto" readonly aria-label="Converted text" placeholder="Converted text appears here." :model-value="tool.output.value" />
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="solid" :icon-left="tool.copied.value ? 'lucide-check' : 'lucide-copy'" :label="tool.copied.value ? 'Copied' : 'Copy output'" :disabled="!tool.output.value" @click="tool.copyOutput()" />
      <Button variant="outline" icon-left="lucide-download" label="Download .txt" :disabled="!tool.output.value" @click="tool.downloadOutput()" />
      <Button variant="ghost" icon-left="lucide-eraser" label="Clear" :disabled="!tool.input.value" @click="tool.clear()" />
      <p class="ml-auto text-xs text-ink-gray-5" role="note">Transliteration can have more than one valid form.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Button, FormControl, Tooltip } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import { ROMAN_SCHEMES, SCRIPT_SCHEMES } from '@/tools/script-conversion/scriptConversion'
import { useScriptConversion } from '@/tools/script-conversion/useScriptConversion'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('script-conversion')
const TOOL_ID = 'script-conversion'

const preferences = useToolboxPreferences()
const tool = useScriptConversion()

// Two groups, searchable: Select has no option-group support, and 18 schemes
// read better with a filter than as one flat list.
const schemeOptions = computed(() => [
  { group: 'Scripts', options: SCRIPT_SCHEMES.map(toSchemeOption) },
  { group: 'Roman', options: ROMAN_SCHEMES.map(toSchemeOption) },
])

function toSchemeOption(scheme) {
  return { label: scheme.label, value: scheme.id, description: scheme.hint }
}

onMounted(() => preferences.recordRecent(TOOL_ID))
</script>
