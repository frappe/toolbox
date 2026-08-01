<template>
  <div ref="root" class="relative min-w-0">
    <span :id="labelId" class="block text-sm font-medium text-ink-gray-7">{{ label }}</span>
    <button ref="trigger" type="button" class="mt-2 flex h-12 w-full items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-left outline-none hover:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3" aria-haspopup="listbox" :aria-labelledby="`${labelId} ${valueId}`" :aria-expanded="open" :data-testid="pickerId" @click="toggle">
      <span :id="valueId" class="w-12 shrink-0 font-semibold text-ink-gray-9">{{ modelValue }}</span>
      <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-6">{{ selectedName }}</span>
      <Icon name="lucide-chevrons-up-down" class="size-4 shrink-0 text-ink-gray-5" />
    </button>
    <div v-if="open" class="absolute left-0 top-full z-30 mt-2 w-full min-w-72 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1 shadow-xl">
      <div class="relative border-b border-outline-gray-2 p-2"><Icon name="lucide-search" class="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" /><input ref="searchInput" v-model="query" type="search" class="h-10 w-full rounded-lg bg-surface-gray-1 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-outline-gray-3" :aria-label="`Search ${label.toLowerCase()}`" placeholder="Search currency name or code" @keydown.esc.prevent="close(true)" /></div>
      <div role="listbox" :aria-label="label" class="max-h-64 overflow-y-auto p-1">
        <button v-for="currency in filtered" :key="currency.code" type="button" role="option" class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2" :aria-selected="currency.code === modelValue" @click="select(currency.code)"><span class="w-12 shrink-0 font-medium text-ink-gray-8">{{ currency.code }}</span><span class="min-w-0 flex-1 truncate text-ink-gray-6">{{ currency.name }}</span><Icon v-if="currency.code === modelValue" name="lucide-check" class="size-4 shrink-0" /><span v-else class="size-4 shrink-0" /></button>
        <p v-if="!filtered.length" class="px-3 py-6 text-center text-sm text-ink-gray-5" role="status">No matching currencies</p>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { Icon } from 'frappe-ui'
import { getCurrencyName, searchCurrencies } from './currencies'
const props = defineProps({ modelValue: { type: String, required: true }, currencies: { type: Array, required: true }, label: { type: String, required: true }, pickerId: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])
const id = useId(), labelId = `currency-label-${id}`, valueId = `currency-value-${id}`
const root = ref(null), trigger = ref(null), searchInput = ref(null), open = ref(false), query = ref('')
const selectedName = computed(() => getCurrencyName(props.modelValue))
const filtered = computed(() => searchCurrencies(props.currencies, query.value))
function toggle() { open.value ? close() : openPicker() }
async function openPicker() { query.value = ''; open.value = true; await nextTick(); searchInput.value?.focus() }
async function close(restore = false) { open.value = false; if (restore) { await nextTick(); trigger.value?.focus() } }
function select(code) { emit('update:modelValue', code); void close(true) }
function outside(event) { if (open.value && !root.value?.contains(event.target)) close() }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
