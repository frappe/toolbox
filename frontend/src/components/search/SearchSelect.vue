<template>
  <div :class="$attrs.class">
    <label :for="inputId" class="block text-sm font-medium text-ink-gray-7">{{ label }}</label>

    <div class="relative mt-2">
      <TextInput
        :id="inputId"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-controls="listId"
        :aria-expanded="isOpen"
        :aria-activedescendant="activeId"
        :model-value="modelValue"
        v-bind="inputAttrs"
        @update:model-value="onQuery"
        @keydown="onKeydown"
      />

      <ul
        v-if="isOpen"
        :id="listId"
        role="listbox"
        :aria-label="resultsLabel"
        class="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-gray-2 bg-surface-base p-2 shadow-lg"
      >
        <li v-for="(result, index) in results" :key="optionKey(result, index)">
          <button
            :id="optionId(index)"
            type="button"
            role="option"
            :aria-selected="index === activeIndex"
            class="min-h-11 w-full rounded-lg px-3 py-2 text-left text-ink-gray-8 hover:bg-surface-gray-2"
            :class="index === activeIndex && 'bg-surface-gray-2'"
            @click="choose(result)"
            @mousemove="activeIndex = index"
          >
            <slot name="option" :result="result" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useAttrs, useId, watch } from 'vue'
import { TextInput } from 'frappe-ui'

// The house pattern for search-and-select fields (#142).
//
// frappe-ui Combobox does not fit these: it owns the query lifecycle and resolves
// the selected option by scanning `options`, so a composable that clears its own
// query and results on select loses the selection. It is also single-value, while
// two of the three call sites add to a list or submit free text instead.
//
// So the pattern stays app-owned, but it is now one component with the full ARIA
// combobox wiring and keyboard support that the three hand-rolled copies lacked.

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  label: { type: String, required: true },
  resultsLabel: { type: String, required: true },
  optionKeyField: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'select'])

// `class` styles the whole field, so it stays on the root and its `[&_input]:`
// variants still reach the input. Everything else is for the input itself.
const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const activeIndex = ref(-1)
const uid = useId()
const inputId = computed(() => `${uid}-input`)
const listId = computed(() => `${uid}-listbox`)

const isOpen = computed(() => props.results.length > 0)
const activeId = computed(() => (isOpen.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined))

// A fresh result set invalidates the highlight.
watch(() => props.results, () => (activeIndex.value = -1))

function optionId(index) {
  return `${uid}-option-${index}`
}

function optionKey(result, index) {
  if (props.optionKeyField && result?.[props.optionKeyField] != null) return result[props.optionKeyField]
  return typeof result === 'string' ? result : index
}

function onQuery(value) {
  emit('update:modelValue', value)
}

function choose(result) {
  emit('select', result)
  activeIndex.value = -1
}

// Enter only claims the key when a result is highlighted, so a wrapping form can
// still submit the typed query.
function onKeydown(event) {
  if (!isOpen.value) return

  const last = props.results.length - 1

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = activeIndex.value >= last ? 0 : activeIndex.value + 1
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? last : activeIndex.value - 1
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    activeIndex.value = event.key === 'Home' ? 0 : last
    return
  }

  if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault()
    choose(props.results[activeIndex.value])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('update:modelValue', '')
    activeIndex.value = -1
  }
}
</script>
