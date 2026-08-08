<template>
  <div class="min-w-0">
    <span :id="labelId" class="block text-xs font-medium text-ink-gray-5">{{ label }}</span>
    <Combobox
      v-model="selectedUnitId"
      v-model:query="query"
      size="md"
      trigger="button"
      :options="options"
      :filterable="false"
      :aria-label="`Search ${label.toLowerCase()}`"
      placeholder="Search name or symbol"
      empty-text="No matching units"
      @update:open="clearQueryOnClose"
    >
      <template #trigger="{ open, setOpen }">
        <button
          type="button"
          class="mt-1 flex h-11 w-full items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-left text-sm text-ink-gray-8 outline-none hover:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          aria-haspopup="listbox"
          :aria-labelledby="`${labelId} ${valueId}`"
          :aria-expanded="open"
          @keydown.down.prevent="setOpen(true)"
        >
          <span :id="valueId" class="min-w-0 flex-1 truncate">{{ selectedUnit.name }}</span>
          <span class="shrink-0 font-medium text-ink-gray-6">{{ selectedUnit.symbol }}</span>
          <Icon name="lucide-chevrons-up-down" class="size-4 shrink-0 text-ink-gray-5" />
        </button>
      </template>

      <template #item-suffix="{ item }">
        <span class="w-20 shrink-0 truncate text-right font-medium text-ink-gray-6">
          {{ item.symbol }}
        </span>
      </template>
    </Combobox>
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { Combobox, Icon } from 'frappe-ui'

import { getUnit } from './registry'
import { searchUnits } from './unitSearch'

const props = defineProps({
  modelValue: { type: String, required: true },
  categoryId: { type: String, required: true },
  label: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])

const componentId = useId()
const labelId = `unit-picker-label-${componentId}`
const valueId = `unit-picker-value-${componentId}`
const query = ref('')
const selectedUnit = computed(() => getUnit(props.modelValue))

// `searchUnits` ranks names, symbols and aliases ("feet" finds Foot), which a
// literal substring filter cannot do — so Combobox's own filter stays off. The
// option list is therefore already filtered, and the trigger reads from our own
// state through the `#trigger` slot instead of from the visible options.
const options = computed(() =>
  searchUnits(query.value, { categoryId: props.categoryId }).map((unit) => ({
    value: unit.id,
    label: unit.name,
    symbol: unit.symbol,
  })),
)

const selectedUnitId = computed({
  get: () => props.modelValue,
  set: (unitId) => {
    if (unitId) emit('update:modelValue', unitId)
  },
})

function clearQueryOnClose(open) {
  if (!open) query.value = ''
}
</script>
