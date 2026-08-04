<template>
  <div
    class="inline-flex gap-1 overflow-x-auto rounded-lg bg-surface-gray-2 p-1"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="tab in tabs"
      :id="`${tab.id}-tab`"
      :key="tab.id"
      type="button"
      role="tab"
      class="h-9 shrink-0 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      :class="
        modelValue === tab.id
          ? 'bg-surface-base text-ink-gray-9 shadow-sm'
          : 'text-ink-gray-6 hover:text-ink-gray-9'
      "
      :data-tab-id="tab.id"
      :aria-selected="modelValue === tab.id"
      :aria-controls="`${tab.id}-panel`"
      :tabindex="modelValue === tab.id ? 0 : -1"
      @click="select(tab.id)"
      @keydown="onKeydown($event, tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  // Each tab: { id, label }.
  tabs: { type: Array, required: true },
  modelValue: { type: String, required: true },
  ariaLabel: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])

function select(tabId) {
  if (tabId !== props.modelValue) emit('update:modelValue', tabId)
}

function onKeydown(event, tabId) {
  const currentIndex = props.tabs.findIndex((tab) => tab.id === tabId)
  const lastIndex = props.tabs.length - 1
  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % props.tabs.length
          : event.key === 'ArrowLeft'
            ? (currentIndex - 1 + props.tabs.length) % props.tabs.length
            : null
  if (targetIndex === null) return

  event.preventDefault()
  const target = props.tabs[targetIndex]
  select(target.id)
  document.getElementById(`${target.id}-tab`)?.focus()
}
</script>
