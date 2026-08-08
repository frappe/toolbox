<template>
  <div class="min-w-0">
    <span :id="labelId" class="block text-sm font-medium text-ink-gray-7">{{ label }}</span>
    <Combobox
      v-model="selectedCode"
      v-model:query="query"
      size="md"
      trigger="button"
      :options="options"
      :filterable="false"
      :aria-label="`Search ${label.toLowerCase()}`"
      placeholder="Search name or code"
      empty-text="No matching currencies"
      @update:open="clearQueryOnClose"
    >
      <template #trigger="{ open }">
        <button type="button" class="mt-2 flex h-12 w-full items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-left outline-none hover:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" aria-haspopup="listbox" :aria-labelledby="`${labelId} ${valueId}`" :aria-expanded="open" :data-testid="pickerId">
          <span :id="valueId" class="w-12 shrink-0 font-semibold text-ink-gray-9">{{ modelValue }}</span>
          <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-6">{{ selectedName }}</span>
          <Icon name="lucide-chevrons-up-down" class="size-4 shrink-0 text-ink-gray-5" />
        </button>
      </template>
      <template #item-prefix="{ item }"><span class="w-12 shrink-0 font-medium text-ink-gray-8">{{ item.value }}</span></template>
    </Combobox>
  </div>
</template>
<script setup>
import { computed, ref, useId } from 'vue'
import { Combobox, Icon } from 'frappe-ui'
import { getCurrencyName, searchCurrencies } from './currencies'
const props = defineProps({ modelValue: { type: String, required: true }, currencies: { type: Array, required: true }, label: { type: String, required: true }, pickerId: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])
const id = useId(), labelId = `currency-label-${id}`, valueId = `currency-value-${id}`
const query = ref('')
const selectedName = computed(() => getCurrencyName(props.modelValue))
// Keep the multi-word code-and-name search, so Combobox's literal substring
// filter is switched off. That also means the trigger renders from our own
// state, not the (filtered) option list — hence the `#trigger` slot.
const options = computed(() => searchCurrencies(props.currencies, query.value).map(({ code, name }) => ({ value: code, label: name })))
const selectedCode = computed({
  get: () => props.modelValue,
  set: (code) => { if (code) emit('update:modelValue', code) },
})
function clearQueryOnClose(open) { if (!open) query.value = '' }
</script>
