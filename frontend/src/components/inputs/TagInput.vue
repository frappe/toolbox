<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="resolvedInputId"
      class="text-sm font-medium text-ink-gray-7"
    >
      {{ label }}
    </label>
    <div
      :class="[
        'flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5 transition motion-reduce:transition-none',
        variantClasses.container,
      ]"
      @click="focusInput"
    >
      <span
        v-for="(tag, index) in modelValue"
        :key="`${index}-${tag}`"
        :class="[
          'inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-0.5 text-sm text-ink-gray-8',
          variantClasses.chip,
        ]"
      >
        {{ tag }}
        <button
          type="button"
          :class="[
            'flex size-5 items-center justify-center rounded text-ink-gray-6 transition hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none',
            variantClasses.chipRemove,
          ]"
          :aria-label="`Remove tag ${tag}`"
          @click="removeAt(index)"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </span>
      <input
        :id="resolvedInputId"
        ref="inputRef"
        v-model="draft"
        type="text"
        autocomplete="off"
        spellcheck="false"
        class="min-w-32 flex-1 bg-transparent py-0.5 text-sm text-ink-gray-9 outline-none placeholder:text-ink-gray-4 disabled:cursor-not-allowed"
        :placeholder="placeholder"
        :disabled="isFull"
        :aria-label="label ? undefined : placeholder"
        @keydown="onKeydown"
        @blur="commit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId } from 'vue'

const props = defineProps({
  // The committed tags. The parent owns this array; we only emit copies.
  modelValue: { type: Array, required: true },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Add a tag…' },
  // 0 means unlimited.
  maxTags: { type: Number, default: 0 },
  inputId: { type: String, default: '' },
  // 'outline' is the original white/bordered field. 'subtle' matches frappe-ui's
  // subtle inputs (gray field that turns white on focus) so the tag field sits
  // flush next to FormControl/TextInput siblings.
  variant: { type: String, default: 'outline' },
})

const emit = defineEmits(['update:modelValue'])

const draft = ref('')
const inputRef = ref(null)

const generatedId = `tag-input-${useId()}`
const resolvedInputId = computed(() => props.inputId || generatedId)

// Chips lift one gray step in the subtle field so they stay legible on the
// gray container; the outline field keeps its original tokens untouched.
const variantClasses = computed(() =>
  props.variant === 'subtle'
    ? {
        container:
          'border border-transparent bg-surface-gray-2 hover:bg-surface-gray-3 focus-within:border-outline-gray-4 focus-within:bg-surface-base focus-within:shadow-sm',
        chip: 'bg-surface-gray-3',
        chipRemove: 'hover:bg-surface-gray-4',
      }
    : {
        container:
          'border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3 focus-within:ring-2 focus-within:ring-outline-gray-3',
        chip: 'bg-surface-gray-2',
        chipRemove: 'hover:bg-surface-gray-3',
      },
)
const isFull = computed(
  () => props.maxTags > 0 && props.modelValue.length >= props.maxTags,
)

function onKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && !draft.value) {
    removeLast()
  }
}

// Add the trimmed draft as a new tag. Dedupe is case-insensitive and keeps
// the first-seen casing, so a repeat clears the field without changing tags.
function commit() {
  if (isFull.value) return
  const value = draft.value.trim()
  if (!value) return
  const isDuplicate = props.modelValue.some(
    (tag) => tag.toLowerCase() === value.toLowerCase(),
  )
  draft.value = ''
  if (isDuplicate) return
  emit('update:modelValue', [...props.modelValue, value])
}

function removeAt(index) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, position) => position !== index),
  )
}

function removeLast() {
  if (!props.modelValue.length) return
  emit('update:modelValue', props.modelValue.slice(0, -1))
}

function focusInput() {
  inputRef.value?.focus()
}
</script>
