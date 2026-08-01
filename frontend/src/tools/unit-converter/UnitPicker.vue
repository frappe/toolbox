<template>
  <div ref="pickerRoot" class="relative min-w-0">
    <span :id="labelId" class="block text-xs font-medium text-ink-gray-5">{{ label }}</span>
    <button
      ref="trigger"
      type="button"
      class="mt-1 flex h-11 w-full items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-left text-sm text-ink-gray-8 outline-none hover:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      aria-haspopup="listbox"
      :aria-labelledby="`${labelId} ${valueId}`"
      :aria-expanded="open"
      :aria-controls="listboxId"
      @click="togglePicker"
      @keydown.down.prevent="openPicker"
    >
      <span :id="valueId" class="min-w-0 flex-1 truncate">{{ selectedUnit.name }}</span>
      <span class="shrink-0 font-medium text-ink-gray-6">{{ selectedUnit.symbol }}</span>
      <Icon name="lucide-chevrons-up-down" class="size-4 shrink-0 text-ink-gray-5" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-30 mt-2 w-full min-w-64 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1 shadow-xl"
    >
      <div class="relative border-b border-outline-gray-2 p-2">
        <Icon
          name="lucide-search"
          class="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5"
        />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          class="h-9 w-full rounded-lg bg-surface-gray-1 pl-9 pr-3 text-sm text-ink-gray-8 outline-none placeholder:text-ink-gray-4 focus:ring-2 focus:ring-outline-gray-3"
          :aria-label="`Search ${label.toLowerCase()}`"
          placeholder="Search name or symbol"
          autocomplete="off"
          @keydown.down.prevent="focusOption(0)"
          @keydown.esc.prevent="closePicker(true)"
        />
      </div>

      <div :id="listboxId" role="listbox" :aria-label="label" class="max-h-64 overflow-y-auto p-1">
        <button
          v-for="(unit, index) in filteredUnits"
          :key="unit.id"
          :ref="(element) => setOptionRef(element, index)"
          type="button"
          role="option"
          class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2"
          :aria-selected="unit.id === modelValue"
          @click="selectUnit(unit.id)"
          @keydown.down.prevent="focusOption(index + 1)"
          @keydown.up.prevent="focusOption(index - 1)"
          @keydown.esc.prevent="closePicker(true)"
        >
          <span class="min-w-0 flex-1 truncate text-ink-gray-8">{{ unit.name }}</span>
          <span class="w-20 shrink-0 truncate text-right font-medium text-ink-gray-6">
            {{ unit.symbol }}
          </span>
          <Icon
            v-if="unit.id === modelValue"
            name="lucide-check"
            class="size-4 shrink-0 text-ink-gray-7"
          />
          <span v-else class="size-4 shrink-0" aria-hidden="true" />
        </button>
        <p v-if="!filteredUnits.length" class="px-3 py-6 text-center text-sm text-ink-gray-5" role="status">
          No matching units
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { Icon } from 'frappe-ui'

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
const listboxId = `unit-picker-list-${componentId}`
const pickerRoot = ref(null)
const trigger = ref(null)
const searchInput = ref(null)
const optionRefs = ref([])
const open = ref(false)
const query = ref('')
const selectedUnit = computed(() => getUnit(props.modelValue))
const filteredUnits = computed(() =>
  searchUnits(query.value, { categoryId: props.categoryId }),
)

function togglePicker() {
  if (open.value) closePicker()
  else openPicker()
}

async function openPicker() {
  if (open.value) return
  query.value = ''
  open.value = true
  await nextTick()
  searchInput.value?.focus()
}

async function closePicker(restoreFocus = false) {
  open.value = false
  optionRefs.value = []
  if (!restoreFocus) return
  await nextTick()
  trigger.value?.focus()
}

function selectUnit(unitId) {
  emit('update:modelValue', unitId)
  closePicker(true)
}

function focusOption(index) {
  if (!optionRefs.value.length) return
  const boundedIndex = Math.min(Math.max(index, 0), optionRefs.value.length - 1)
  optionRefs.value[boundedIndex]?.focus()
}

function setOptionRef(element, index) {
  if (element) optionRefs.value[index] = element
}

function handleOutsidePointer(event) {
  if (open.value && !pickerRoot.value?.contains(event.target)) closePicker()
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer))
</script>
