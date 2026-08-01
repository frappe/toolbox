<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-percent" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Calculate</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          GST Calculator
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Add or remove GST and see the intra-state or inter-state tax split.
        </p>
      </div>
      <Button
        class="h-11"
        variant="subtle"
        icon="lucide-star"
        :label="preferences.isFavourite('gst-calculator') ? 'Favourited' : 'Favourite'"
        @click="preferences.toggleFavourite('gst-calculator')"
      />
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section
        class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6"
        aria-labelledby="gst-inputs-heading"
      >
        <h2 id="gst-inputs-heading" class="sr-only">GST calculation inputs</h2>

        <fieldset>
          <legend class="text-sm font-medium text-ink-gray-7">Calculation</legend>
          <div class="grid grid-cols-2 gap-2 pt-2">
            <Button
              class="h-11"
              label="Add GST"
              :variant="calculator.mode.value === GST_MODES.ADD ? 'subtle' : 'ghost'"
              :aria-pressed="calculator.mode.value === GST_MODES.ADD"
              data-mode="add"
              @click="calculator.setMode(GST_MODES.ADD)"
            />
            <Button
              class="h-11"
              label="Remove GST"
              :variant="calculator.mode.value === GST_MODES.REMOVE ? 'subtle' : 'ghost'"
              :aria-pressed="calculator.mode.value === GST_MODES.REMOVE"
              data-mode="remove"
              @click="calculator.setMode(GST_MODES.REMOVE)"
            />
          </div>
        </fieldset>

        <div class="pt-6">
          <label for="gst-amount" class="block text-sm font-medium text-ink-gray-7">
            {{ calculator.amountLabel.value }}
          </label>
          <div class="relative mt-2">
            <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-ink-gray-5">
              ₹
            </span>
            <input
              id="gst-amount"
              :value="calculator.amountInput.value"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              class="h-12 w-full rounded-xl border border-outline-gray-2 bg-surface-base pl-9 pr-4 text-xl font-medium tabular-nums text-ink-gray-9 outline-none placeholder:text-ink-gray-3 focus:ring-2 focus:ring-outline-gray-3"
              placeholder="0.00"
              aria-describedby="gst-feedback"
              :aria-invalid="Boolean(calculator.errorMessage.value) || undefined"
              @input="calculator.updateAmount($event.target.value)"
            />
          </div>
        </div>

        <div class="pt-6">
          <GstRatePicker
            :selected-rate-id="calculator.selectedRateId.value"
            :custom-rate-input="calculator.customRateInput.value"
            @select="calculator.selectRate"
            @update:custom-rate-input="calculator.updateCustomRate"
          />
          <p v-if="calculator.handoffApplied.value" class="flex items-center gap-2 pt-3 text-sm text-ink-gray-5">
            <Icon name="lucide-import" class="size-4 shrink-0" />
            Rate supplied by HSN lookup.
          </p>
        </div>

        <fieldset class="pt-6">
          <legend class="text-sm font-medium text-ink-gray-7">Place of supply</legend>
          <div class="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <Button
              class="h-11"
              label="Intra-state · CGST + SGST"
              :variant="calculator.supplyType.value === GST_SUPPLY_TYPES.INTRA_STATE ? 'subtle' : 'ghost'"
              :aria-pressed="calculator.supplyType.value === GST_SUPPLY_TYPES.INTRA_STATE"
              data-supply-type="intra-state"
              @click="calculator.setSupplyType(GST_SUPPLY_TYPES.INTRA_STATE)"
            />
            <Button
              class="h-11"
              label="Inter-state · IGST"
              :variant="calculator.supplyType.value === GST_SUPPLY_TYPES.INTER_STATE ? 'subtle' : 'ghost'"
              :aria-pressed="calculator.supplyType.value === GST_SUPPLY_TYPES.INTER_STATE"
              data-supply-type="inter-state"
              @click="calculator.setSupplyType(GST_SUPPLY_TYPES.INTER_STATE)"
            />
          </div>
        </fieldset>

        <div id="gst-feedback" class="pt-4">
          <p
            v-if="calculator.errorMessage.value"
            class="rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-3"
            role="alert"
          >
            {{ calculator.errorMessage.value }}
          </p>
          <p v-else-if="calculator.inputHint.value" class="text-sm leading-6 text-ink-gray-5">
            {{ calculator.inputHint.value }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2 pt-5">
          <Button
            class="h-11"
            label="Copy summary"
            variant="solid"
            icon="lucide-copy"
            :disabled="!calculator.canCopy.value"
            @click="calculator.copyResult()"
          />
          <Button class="h-11" label="Clear" variant="subtle" @click="calculator.clear" />
          <Button class="h-11" label="Reset" variant="ghost" @click="calculator.reset" />
        </div>
      </section>

      <GstResults
        class="lg:sticky lg:top-6"
        :result="calculator.result.value"
        :final-amount-label="calculator.finalAmountLabel.value"
      />
    </div>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="gst-result-status">
      {{ calculator.resultAnnouncement.value }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" data-testid="gst-copy-status">
      {{ calculator.copyStatus.value }}
    </p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import GstRatePicker from '@/tools/gst-calculator/GstRatePicker.vue'
import GstResults from '@/tools/gst-calculator/GstResults.vue'
import { GST_MODES, GST_SUPPLY_TYPES } from '@/tools/gst-calculator'
import { useGstCalculator } from '@/tools/gst-calculator/useGstCalculator'

const preferences = useToolboxPreferences()
const initialRate = new URLSearchParams(globalThis.location?.search ?? '').get('rate')
const calculator = useGstCalculator({ initialRate })

onMounted(() => preferences.recordRecent('gst-calculator'))
</script>
