<template>
  <details class="border-t border-outline-gray-2 pt-5">
    <summary
      class="cursor-pointer rounded-md text-sm font-medium text-ink-gray-8 outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
    >
      View all {{ schedule.length }} payments
    </summary>
    <div class="mt-4 max-h-96 overflow-auto rounded-xl border border-outline-gray-2">
      <table class="w-full min-w-[38rem] border-collapse text-sm">
        <caption class="sr-only">
          Loan amortization schedule
        </caption>
        <thead class="sticky top-0 bg-surface-gray-1 text-left text-ink-gray-6">
          <tr>
            <th class="px-3 py-2 font-medium">Payment</th>
            <th class="px-3 py-2 text-right font-medium">Amount</th>
            <th class="px-3 py-2 text-right font-medium">Principal</th>
            <th class="px-3 py-2 text-right font-medium">Interest</th>
            <th class="px-3 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-gray-2 text-ink-gray-8">
          <tr v-for="row in schedule" :key="row.period">
            <td class="px-3 py-2 tabular-nums">{{ row.period }}</td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ formatCurrency(row.payment) }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ formatCurrency(row.principal) }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ formatCurrency(row.interest) }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ formatCurrency(row.balance) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup>
defineProps({
  schedule: { type: Array, required: true },
  formatCurrency: { type: Function, required: true },
})
</script>
