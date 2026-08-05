<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-wallet" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Money</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Personal Expenses</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Log what you spend, see where it goes, and let Toolbox suggest categories as you type.</p>
      </div>
      <Button variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <!-- Error state -->
    <div v-if="expenses.state.value === 'error'" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center" role="alert">
      <Icon name="lucide-wifi-off" class="mx-auto size-7 text-ink-gray-5" />
      <h2 class="pt-3 text-base font-semibold text-ink-gray-9">Your expenses could not be loaded</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">{{ expenses.errorMessage.value }}</p>
      <Button class="mt-4" label="Try again" @click="expenses.load" />
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="expenses.state.value === 'loading'" class="mt-8 space-y-3" aria-hidden="true">
      <div v-for="row in 4" :key="row" class="h-16 animate-pulse rounded-xl bg-surface-gray-2 motion-reduce:animate-none" />
    </div>

    <!-- Empty state -->
    <section v-else-if="isPrimaryEmpty" class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-10 text-center">
      <Icon name="lucide-receipt" class="mx-auto size-8 text-ink-gray-5" />
      <h2 class="pt-3 text-lg font-semibold text-ink-gray-9">No expenses yet</h2>
      <p class="mx-auto max-w-md pt-2 text-sm leading-6 text-ink-gray-6">Add your first expense and Toolbox starts tracking your monthly spend, categories, and top merchants.</p>
      <Button class="mt-5" variant="solid" icon="lucide-plus" label="Add expense" @click="onNewExpense" />
    </section>

    <!-- Main -->
    <div v-else class="mt-8">
      <!-- Sub navigation -->
      <div class="inline-flex rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-0.5" role="tablist" aria-label="Expenses sections">
        <button v-for="tab in viewTabs" :key="tab.value" type="button" role="tab" :aria-selected="expenses.view.value === tab.value" class="rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" :class="expenses.view.value === tab.value ? 'bg-surface-base text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-8'" @click="onSetView(tab.value)">{{ tab.label }}</button>
      </div>

      <!-- Dashboard -->
      <div v-if="expenses.view.value === 'dashboard'" class="mt-6">
        <div v-if="dash" class="flex flex-col gap-6">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Spend this month</p>
              <p class="mt-2 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ formatMoney(dash.spend_this_month, dash.currency) }}</p>
            </div>
            <div class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Last month</p>
              <p class="mt-2 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ formatMoney(dash.spend_last_month, dash.currency) }}</p>
            </div>
            <div class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Change</p>
              <p class="mt-2 text-2xl font-semibold tabular-nums" :class="changeClass">{{ changeText }}</p>
            </div>
            <div class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Expenses</p>
              <p class="mt-2 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ dash.expense_count }}</p>
            </div>
          </div>

          <p v-if="dash.other_currency_count > 0" class="rounded-xl border border-outline-gray-2 bg-surface-amber-1 px-3 py-2 text-sm leading-6 text-ink-gray-8">
            {{ dash.other_currency_count }} {{ dash.other_currency_count === 1 ? 'expense is' : 'expenses are' }} in other currencies and excluded from these totals.
          </p>

          <div class="grid gap-6 lg:grid-cols-2">
            <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4" aria-labelledby="dash-categories">
              <h2 id="dash-categories" class="text-sm font-semibold text-ink-gray-8">Categories this month</h2>
              <ul v-if="dash.category_breakdown && dash.category_breakdown.length" class="mt-3 flex flex-col gap-3">
                <li v-for="item in dash.category_breakdown" :key="item.label">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="min-w-0 truncate text-sm text-ink-gray-7">{{ item.label }}</span>
                    <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(item.amount, dash.currency) }}</span>
                  </div>
                  <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                    <div class="h-full rounded-full bg-ink-gray-7 transition-all motion-reduce:transition-none" :style="{ width: `${barPct(item.amount, maxCategoryAmount)}%` }" />
                  </div>
                </li>
              </ul>
              <p v-else class="mt-3 text-sm text-ink-gray-5">No spending recorded this month.</p>
            </section>

            <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4" aria-labelledby="dash-merchants">
              <h2 id="dash-merchants" class="text-sm font-semibold text-ink-gray-8">Top merchants</h2>
              <ul v-if="dash.top_merchants && dash.top_merchants.length" class="mt-3 flex flex-col gap-3">
                <li v-for="item in dash.top_merchants" :key="item.label">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="min-w-0 truncate text-sm text-ink-gray-7">{{ item.label }}</span>
                    <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(item.amount, dash.currency) }}</span>
                  </div>
                  <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                    <div class="h-full rounded-full bg-ink-gray-7 transition-all motion-reduce:transition-none" :style="{ width: `${barPct(item.amount, maxMerchantAmount)}%` }" />
                  </div>
                </li>
              </ul>
              <p v-else class="mt-3 text-sm text-ink-gray-5">No merchants recorded yet.</p>
            </section>
          </div>

          <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4" aria-labelledby="dash-recent">
            <h2 id="dash-recent" class="text-sm font-semibold text-ink-gray-8">Recent</h2>
            <ul v-if="dash.recent && dash.recent.length" class="mt-3 flex flex-col gap-1.5">
              <li v-for="row in dash.recent" :key="row.name" class="flex items-center justify-between gap-3 rounded-xl border border-outline-gray-2 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink-gray-9">{{ row.description || 'Expense' }}</p>
                  <p class="mt-0.5 text-xs text-ink-gray-5">{{ row.expense_date }}<span v-if="row.category_name"> · {{ row.category_name }}</span></p>
                </div>
                <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(row.amount, row.currency) }}</span>
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-ink-gray-5">Nothing here yet.</p>
          </section>
        </div>
        <p v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 px-4 py-10 text-center text-sm text-ink-gray-6">The dashboard could not be loaded.</p>
      </div>

      <!-- Expenses list -->
      <div v-else-if="expenses.view.value === 'list'" class="mt-6">
        <!-- Toolbar -->
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="relative min-w-0 flex-1">
              <Icon name="lucide-search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
              <input :value="expenses.filters.search" type="search" autocomplete="off" spellcheck="false" placeholder="Search expenses" aria-label="Search expenses" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base pl-9 pr-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="expenses.setSearch($event.target.value)" />
            </div>
            <div class="flex items-center gap-2">
              <Button variant="solid" icon="lucide-plus" label="Add expense" @click="onNewExpense" />
              <div class="relative">
                <Button variant="outline" icon="lucide-download" label="Export" aria-haspopup="menu" :aria-expanded="showExportMenu" @click="showExportMenu = !showExportMenu" />
                <div v-if="showExportMenu" class="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-outline-gray-2 bg-surface-base p-1 shadow-lg" role="menu">
                  <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('json')">JSON</button>
                  <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" @click="onExport('csv')">CSV</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Filters -->
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <label for="filter-category" class="text-xs font-medium text-ink-gray-6">Category</label>
              <select id="filter-category" v-model="expenses.filters.category" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()">
                <option value="">All categories</option>
                <option v-for="cat in expenses.activeCategories.value" :key="cat.name" :value="cat.name">{{ cat.category_name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="filter-method" class="text-xs font-medium text-ink-gray-6">Payment method</label>
              <select id="filter-method" v-model="expenses.filters.payment_method" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()">
                <option value="">All methods</option>
                <option v-for="method in expenses.paymentMethods.value" :key="method.name" :value="method.name">{{ method.method_name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="filter-currency" class="text-xs font-medium text-ink-gray-6">Currency</label>
              <input id="filter-currency" v-model="expenses.filters.currency" type="text" autocomplete="off" spellcheck="false" placeholder="Any" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm uppercase text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="filter-from" class="text-xs font-medium text-ink-gray-6">From</label>
              <input id="filter-from" v-model="expenses.filters.from_date" type="date" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="filter-to" class="text-xs font-medium text-ink-gray-6">To</label>
              <input id="filter-to" v-model="expenses.filters.to_date" type="date" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="filter-sort" class="text-xs font-medium text-ink-gray-6">Sort</label>
              <select id="filter-sort" v-model="expenses.filters.sort" class="h-9 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.applyFilters()">
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
          </div>

          <div v-if="hasActiveFilters" class="flex justify-end">
            <Button variant="ghost" icon="lucide-x" label="Reset filters" @click="expenses.resetFilters()" />
          </div>
        </div>

        <!-- Quick-add / edit form -->
        <form v-if="form" class="mt-6 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6" aria-label="Expense details" @submit.prevent="onSave">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-gray-9">{{ form.name ? 'Edit expense' : 'Add expense' }}</h2>
            <Button variant="ghost" icon="lucide-x" aria-label="Close form" @click="expenses.closeForm()" />
          </div>

          <div class="mt-4 flex flex-col gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label for="expense-amount" class="text-sm font-medium text-ink-gray-7">Amount</label>
                <input id="expense-amount" v-model.number="form.amount" type="number" min="0" step="0.01" required placeholder="0.00" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm tabular-nums text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="expense-currency" class="text-sm font-medium text-ink-gray-7">Currency</label>
                <select id="expense-currency" v-model="form.currency" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
                  <option v-for="code in currencyOptions" :key="code" :value="code">{{ code }}</option>
                </select>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="expense-date" class="text-sm font-medium text-ink-gray-7">Date</label>
              <input id="expense-date" v-model="form.expense_date" type="date" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="expense-description" class="text-sm font-medium text-ink-gray-7">Description</label>
              <input id="expense-description" v-model="form.description" type="text" required placeholder="What was this for?" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="expenses.requestSuggestion()" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="expense-merchant" class="text-sm font-medium text-ink-gray-7">Merchant</label>
              <input id="expense-merchant" v-model="form.merchant" type="text" placeholder="Where did you spend it? (optional)" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @input="expenses.requestSuggestion()" />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="expense-category" class="text-sm font-medium text-ink-gray-7">Category</label>
              <select id="expense-category" v-model="form.category" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @change="expenses.markCategoryTouched()">
                <option value="">Select a category</option>
                <option v-for="cat in expenses.activeCategories.value" :key="cat.name" :value="cat.name">{{ cat.category_name }}</option>
              </select>
              <p v-if="expenses.suggestion.value" class="text-xs leading-5 text-ink-gray-5">
                <Icon name="lucide-sparkles" class="mr-0.5 inline size-3.5 align-text-bottom" aria-hidden="true" />{{ confidenceLabel(expenses.suggestion.value.confidence) }} · {{ expenses.suggestion.value.explanation }}
              </p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="expense-method" class="text-sm font-medium text-ink-gray-7">Payment method</label>
              <select id="expense-method" v-model="form.payment_method" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
                <option value="">None</option>
                <option v-for="method in expenses.paymentMethods.value" :key="method.name" :value="method.name">{{ method.method_name }}</option>
              </select>
            </div>

            <details class="rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2">
              <summary class="cursor-pointer select-none text-sm font-medium text-ink-gray-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3">More details</summary>
              <div class="mt-3 flex flex-col gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <label for="expense-account" class="text-sm font-medium text-ink-gray-7">Account label</label>
                    <input id="expense-account" v-model="form.account_label" type="text" placeholder="e.g. HDFC ••4321" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label for="expense-reference" class="text-sm font-medium text-ink-gray-7">Reference number</label>
                    <input id="expense-reference" v-model="form.reference_number" type="text" placeholder="Optional" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="expense-note" class="text-sm font-medium text-ink-gray-7">Note</label>
                  <textarea id="expense-note" v-model="form.note" rows="2" placeholder="Add a note (optional)" class="w-full resize-y rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2 text-sm text-ink-gray-8 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="flex flex-col gap-1.5">
                    <label for="expense-base-currency" class="text-sm font-medium text-ink-gray-7">Base currency</label>
                    <input id="expense-base-currency" v-model="form.base_currency" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. INR" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm uppercase text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label for="expense-conversion" class="text-sm font-medium text-ink-gray-7">Conversion rate</label>
                    <input id="expense-conversion" v-model.number="form.conversion_rate" type="number" min="0" step="0.0001" placeholder="1.0000" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm tabular-nums text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
                  </div>
                </div>
              </div>
            </details>

            <TagInput :model-value="form.tags" label="Tags" placeholder="Add a tag…" @update:model-value="form.tags = $event" />
          </div>

          <p class="sr-only" role="status" aria-live="polite">{{ savingStatus }}</p>
          <p v-if="expenses.saveError.value" class="mt-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ expenses.saveError.value }}</p>

          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="solid" type="submit" :loading="expenses.saving.value" :label="expenses.saving.value ? 'Saving…' : 'Save expense'" />
            <Button v-if="expenses.canLearnRule.value" variant="outline" icon="lucide-wand-2" :loading="expenses.saving.value" label="Save & remember merchant" @click="onSaveAndLearn" />
            <Button variant="ghost" label="Cancel" @click="expenses.closeForm()" />
            <span v-if="expenses.canLearnRule.value" class="text-xs text-ink-gray-5">Remembering auto-categorises this merchant next time.</span>
          </div>
        </form>

        <!-- List -->
        <div class="mt-6">
          <ul v-if="expenses.expenses.value.length" class="flex flex-col gap-1.5">
            <li v-for="row in expenses.expenses.value" :key="row.name" :data-expense-name="row.name" class="rounded-xl border border-outline-gray-2 bg-surface-base p-3">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <p class="truncate text-sm font-medium text-ink-gray-9">{{ row.description || 'Expense' }}</p>
                    <span v-if="row.merchant" class="shrink-0 truncate text-xs text-ink-gray-5">{{ row.merchant }}</span>
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray-5">
                    <span>{{ row.expense_date }}</span>
                    <span v-if="row.category_name">{{ row.category_name }}</span>
                    <span v-if="row.payment_method_name">{{ row.payment_method_name }}</span>
                  </div>
                  <ul v-if="row.tags && row.tags.length" class="mt-2 flex flex-wrap gap-1" aria-label="Tags">
                    <li v-for="tag in row.tags" :key="tag" class="rounded-md bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-7">{{ tag }}</li>
                  </ul>
                </div>
                <div class="flex shrink-0 items-start gap-3">
                  <div class="text-right">
                    <p class="text-sm font-semibold tabular-nums text-ink-gray-9">{{ formatMoney(row.amount, row.currency) }}</p>
                    <p v-if="row.base_amount" class="text-xs tabular-nums text-ink-gray-5">{{ formatMoney(row.base_amount, row.base_currency) }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <Button variant="subtle" icon="lucide-pencil" aria-label="Edit expense" @click="onEditExpense(row)" />
                    <template v-if="confirmingExpenseDelete === row.name">
                      <span class="text-xs text-ink-gray-7">Delete?</span>
                      <Button variant="ghost" label="Cancel" @click="confirmingExpenseDelete = null" />
                      <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDeleteExpense(row.name)" />
                    </template>
                    <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete expense" @click="confirmingExpenseDelete = row.name" />
                  </div>
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 px-4 py-10 text-center text-sm text-ink-gray-6">{{ hasActiveFilters ? 'No expenses match your filters.' : 'No expenses to show.' }}</p>

          <div v-if="expenses.expenses.value.length" class="mt-4 flex flex-col items-center gap-2">
            <Button v-if="expenses.hasMore.value" variant="outline" :loading="expenses.listLoading.value" label="Load more" @click="expenses.loadMore()" />
            <p class="text-xs text-ink-gray-5">Showing {{ expenses.expenses.value.length }} of {{ expenses.total.value }}</p>
          </div>
        </div>
      </div>

      <!-- Settings -->
      <div v-else class="mt-6 flex flex-col gap-6">
        <!-- Categories -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-categories">
          <h2 id="settings-categories" class="text-sm font-semibold text-ink-gray-8">Categories</h2>
          <ul class="mt-3 flex flex-col gap-1.5">
            <li v-for="cat in expenses.categories.value" :key="cat.name" class="rounded-xl border border-outline-gray-2 px-3 py-2" :class="{ 'opacity-70': cat.is_archived }">
              <div v-if="editingCategory === cat.name" class="flex flex-wrap items-center gap-2">
                <input v-model="editCategoryBuffer" type="text" :aria-label="`Rename ${cat.category_name}`" class="h-9 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @keydown.enter.prevent="onRenameCategory(cat)" />
                <Button variant="solid" label="Save" @click="onRenameCategory(cat)" />
                <Button variant="ghost" label="Cancel" @click="editingCategory = null" />
              </div>
              <div v-else class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ cat.category_name }}</span>
                <span v-if="cat.is_archived" class="shrink-0 rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-6">Archived</span>
                <Button variant="ghost" icon="lucide-pencil" aria-label="Rename category" @click="onStartRenameCategory(cat)" />
                <Button variant="ghost" :icon="cat.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="cat.is_archived ? 'Restore' : 'Archive'" @click="onToggleArchiveCategory(cat)" />
                <template v-if="confirmingCategoryDelete === cat.name">
                  <span class="text-xs text-ink-gray-7">Delete?</span>
                  <Button variant="ghost" label="Cancel" @click="confirmingCategoryDelete = null" />
                  <Button variant="solid" theme="red" label="Delete" @click="onDeleteCategory(cat)" />
                </template>
                <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete category" @click="onConfirmCategoryDelete(cat)" />
              </div>
            </li>
          </ul>
          <form class="mt-3 flex gap-2" @submit.prevent="onAddCategory">
            <label for="new-category" class="sr-only">Add a category</label>
            <input id="new-category" v-model="newCategoryName" type="text" autocomplete="off" placeholder="Add a category" class="h-10 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            <Button variant="subtle" icon="lucide-plus" label="Add" type="submit" />
          </form>
          <p v-if="categoryError" class="mt-3 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ categoryError }}</p>
        </section>

        <!-- Payment methods -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-methods">
          <h2 id="settings-methods" class="text-sm font-semibold text-ink-gray-8">Payment methods</h2>
          <ul class="mt-3 flex flex-col gap-1.5">
            <li v-for="method in expenses.paymentMethods.value" :key="method.name" class="rounded-xl border border-outline-gray-2 px-3 py-2" :class="{ 'opacity-70': method.is_archived }">
              <div v-if="editingMethod === method.name" class="flex flex-wrap items-center gap-2">
                <input v-model="editMethodBuffer" type="text" :aria-label="`Rename ${method.method_name}`" class="h-9 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" @keydown.enter.prevent="onRenameMethod(method)" />
                <Button variant="solid" label="Save" @click="onRenameMethod(method)" />
                <Button variant="ghost" label="Cancel" @click="editingMethod = null" />
              </div>
              <div v-else class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ method.method_name }}</span>
                <span v-if="method.is_archived" class="shrink-0 rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-6">Archived</span>
                <Button variant="ghost" icon="lucide-pencil" aria-label="Rename payment method" @click="onStartRenameMethod(method)" />
                <Button variant="ghost" :icon="method.is_archived ? 'lucide-archive-restore' : 'lucide-archive'" :label="method.is_archived ? 'Restore' : 'Archive'" @click="onToggleArchiveMethod(method)" />
                <template v-if="confirmingMethodDelete === method.name">
                  <span class="text-xs text-ink-gray-7">Delete?</span>
                  <Button variant="ghost" label="Cancel" @click="confirmingMethodDelete = null" />
                  <Button variant="solid" theme="red" label="Delete" @click="onDeleteMethod(method)" />
                </template>
                <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete payment method" @click="onConfirmMethodDelete(method)" />
              </div>
            </li>
          </ul>
          <form class="mt-3 flex gap-2" @submit.prevent="onAddMethod">
            <label for="new-method" class="sr-only">Add a payment method</label>
            <input id="new-method" v-model="newMethodName" type="text" autocomplete="off" placeholder="Add a payment method" class="h-10 min-w-0 flex-1 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            <Button variant="subtle" icon="lucide-plus" label="Add" type="submit" />
          </form>
          <p v-if="methodError" class="mt-3 rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ methodError }}</p>
        </section>

        <!-- Rules -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-rules">
          <div class="flex items-center justify-between gap-3">
            <h2 id="settings-rules" class="text-sm font-semibold text-ink-gray-8">Auto-categorisation rules</h2>
            <Button v-if="!ruleForm" variant="subtle" icon="lucide-plus" label="Add rule" @click="onNewRule" />
          </div>

          <form v-if="ruleForm" class="mt-3 flex flex-col gap-3 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-3" aria-label="Rule details" @submit.prevent="onSaveRule">
            <div class="flex flex-col gap-1.5">
              <label for="rule-name" class="text-sm font-medium text-ink-gray-7">Rule name</label>
              <input id="rule-name" v-model="ruleForm.rule_name" type="text" required placeholder="e.g. Uber rides" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label for="rule-field" class="text-sm font-medium text-ink-gray-7">Match field</label>
                <select id="rule-field" v-model="ruleForm.match_field" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
                  <option value="merchant">Merchant</option>
                  <option value="description">Description</option>
                  <option value="combined">Merchant + description</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="rule-type" class="text-sm font-medium text-ink-gray-7">Match type</label>
                <select id="rule-type" v-model="ruleForm.match_type" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
                  <option value="exact">Exact</option>
                  <option value="contains">Contains</option>
                  <option value="starts_with">Starts with</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="rule-pattern" class="text-sm font-medium text-ink-gray-7">Pattern</label>
              <input id="rule-pattern" v-model="ruleForm.pattern" type="text" required placeholder="Text to match" class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="rule-category" class="text-sm font-medium text-ink-gray-7">Category</label>
              <select id="rule-category" v-model="ruleForm.category" required class="h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-sm text-ink-gray-9 outline-none transition focus-visible:border-outline-gray-3 focus-visible:ring-2 focus-visible:ring-outline-gray-3 motion-reduce:transition-none">
                <option value="">Select a category</option>
                <option v-for="cat in expenses.activeCategories.value" :key="cat.name" :value="cat.name">{{ cat.category_name }}</option>
              </select>
            </div>
            <p v-if="ruleError" class="rounded-lg bg-surface-red-1 px-3 py-2 text-sm leading-6 text-ink-red-4" role="alert">{{ ruleError }}</p>
            <div class="flex items-center gap-2">
              <Button variant="solid" type="submit" label="Save rule" />
              <Button variant="ghost" label="Cancel" @click="ruleForm = null" />
            </div>
          </form>

          <ul v-if="expenses.rules.value.length" class="mt-3 flex flex-col gap-1.5">
            <li v-for="rule in expenses.rules.value" :key="rule.name" class="rounded-xl border border-outline-gray-2 px-3 py-2" :class="{ 'opacity-70': !rule.is_active }">
              <div class="flex flex-wrap items-center gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink-gray-8">{{ rule.rule_name }}</p>
                  <p class="mt-0.5 text-xs text-ink-gray-5">{{ rule.match_field }} {{ rule.match_type }} “{{ rule.pattern }}” → {{ rule.category_name }}</p>
                </div>
                <Button variant="ghost" icon="lucide-pencil" aria-label="Edit rule" @click="onEditRule(rule)" />
                <template v-if="confirmingRuleDelete === rule.name">
                  <span class="text-xs text-ink-gray-7">Delete?</span>
                  <Button variant="ghost" label="Cancel" @click="confirmingRuleDelete = null" />
                  <Button variant="solid" theme="red" label="Delete" @click="onDeleteRule(rule)" />
                </template>
                <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete rule" @click="confirmingRuleDelete = rule.name" />
              </div>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-ink-gray-5">No rules yet. Add one to auto-categorise matching expenses.</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { confidenceLabel, formatMoney, useExpenses } from '@/tools/expenses/useExpenses'

const TOOL_ID = 'expenses'

const preferences = useToolboxPreferences()
const expenses = useExpenses({ defaultCurrency: preferences.settings?.defaultCurrency || 'INR' })

const showExportMenu = ref(false)
const confirmingExpenseDelete = ref(null)
let rulesLoaded = false

// Settings: categories
const newCategoryName = ref('')
const editingCategory = ref(null)
const editCategoryBuffer = ref('')
const confirmingCategoryDelete = ref(null)
const categoryError = ref('')

// Settings: payment methods
const newMethodName = ref('')
const editingMethod = ref(null)
const editMethodBuffer = ref('')
const confirmingMethodDelete = ref(null)
const methodError = ref('')

// Settings: rules
const ruleForm = ref(null)
const confirmingRuleDelete = ref(null)
const ruleError = ref('')

const viewTabs = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'list', label: 'Expenses' },
  { value: 'settings', label: 'Settings' },
]

const sortOptions = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Amount: high to low' },
  { value: 'amount_asc', label: 'Amount: low to high' },
]

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD']

// A convenience view over the open form so the template stays readable. Fields v-model directly
// onto this reactive object; the form is explicit-save, so nothing persists until Save.
const form = computed(() => expenses.activeExpense.value)
const dash = computed(() => expenses.dashboardData.value)

const savingStatus = computed(() => (expenses.saving.value ? 'Saving your expense…' : ''))

// Always include the form's current currency so an unusual saved value still shows in the select.
const currencyOptions = computed(() => {
  const code = form.value?.currency
  return code && !CURRENCY_OPTIONS.includes(code) ? [code, ...CURRENCY_OPTIONS] : CURRENCY_OPTIONS
})

const hasActiveFilters = computed(() => {
  const f = expenses.filters
  return Boolean(f.search || f.category || f.payment_method || f.currency || f.from_date || f.to_date)
})

const hasDashboardActivity = computed(() => {
  const d = dash.value
  return Boolean(d && (d.spend_this_month || d.spend_last_month || d.expense_count))
})

// The full "No expenses yet" card is only for a genuinely empty ledger with nothing on the
// dashboard and no open form. In every other case the tabs stay visible.
const isPrimaryEmpty = computed(
  () =>
    expenses.state.value === 'ready' &&
    expenses.expenses.value.length === 0 &&
    expenses.total.value === 0 &&
    !expenses.activeExpense.value &&
    !hasActiveFilters.value &&
    !hasDashboardActivity.value,
)

const maxCategoryAmount = computed(() =>
  Math.max(0, ...(dash.value?.category_breakdown || []).map((c) => c.amount || 0)),
)
const maxMerchantAmount = computed(() =>
  Math.max(0, ...(dash.value?.top_merchants || []).map((m) => m.amount || 0)),
)

// A rising monthly spend reads red, a falling one green; a missing baseline shows a dash.
const changeText = computed(() => {
  const pct = dash.value?.change_pct
  if (pct === null || pct === undefined) return '—'
  return `${pct > 0 ? '+' : ''}${Math.round(pct)}%`
})
const changeClass = computed(() => {
  const pct = dash.value?.change_pct
  if (pct === null || pct === undefined) return 'text-ink-gray-6'
  if (pct > 0) return 'text-ink-red-4'
  if (pct < 0) return 'text-ink-green-7'
  return 'text-ink-gray-6'
})

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  void expenses.load()
})

function barPct(amount, max) {
  return max > 0 ? Math.round(((amount || 0) / max) * 100) : 0
}

function onSetView(next) {
  showExportMenu.value = false
  confirmingExpenseDelete.value = null
  expenses.view.value = next
  if (next === 'settings' && !rulesLoaded) {
    rulesLoaded = true
    void expenses.loadRules()
  }
}

function onNewExpense() {
  showExportMenu.value = false
  confirmingExpenseDelete.value = null
  expenses.view.value = 'list'
  expenses.newExpense()
}

function onEditExpense(row) {
  confirmingExpenseDelete.value = null
  expenses.view.value = 'list'
  expenses.editExpense(row)
}

async function onDeleteExpense(name) {
  await expenses.removeExpense(name)
  confirmingExpenseDelete.value = null
}

function onExport(format) {
  showExportMenu.value = false
  if (format === 'json') void expenses.exportJson()
  else void expenses.exportCsv()
}

async function onSave() {
  await expenses.saveActive()
}

async function onSaveAndLearn() {
  await expenses.saveActive({ learn: true })
}

// --- settings: categories ---

async function onAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  categoryError.value = ''
  try {
    await expenses.saveCategory({ category_name: name })
    newCategoryName.value = ''
  } catch (error) {
    categoryError.value = readMessage(error)
  }
}

function onStartRenameCategory(cat) {
  categoryError.value = ''
  confirmingCategoryDelete.value = null
  editingCategory.value = cat.name
  editCategoryBuffer.value = cat.category_name
}

async function onRenameCategory(cat) {
  const name = editCategoryBuffer.value.trim()
  if (!name) return
  try {
    await expenses.saveCategory({ name: cat.name, category_name: name })
    editingCategory.value = null
  } catch (error) {
    categoryError.value = readMessage(error)
  }
}

async function onToggleArchiveCategory(cat) {
  categoryError.value = ''
  try {
    await expenses.saveCategory({ name: cat.name, category_name: cat.category_name, is_archived: cat.is_archived ? 0 : 1 })
  } catch (error) {
    categoryError.value = readMessage(error)
  }
}

function onConfirmCategoryDelete(cat) {
  categoryError.value = ''
  confirmingCategoryDelete.value = cat.name
}

async function onDeleteCategory(cat) {
  try {
    await expenses.removeCategory(cat.name)
    confirmingCategoryDelete.value = null
  } catch (error) {
    confirmingCategoryDelete.value = null
    categoryError.value = readMessage(error)
  }
}

// --- settings: payment methods ---

async function onAddMethod() {
  const name = newMethodName.value.trim()
  if (!name) return
  methodError.value = ''
  try {
    await expenses.savePaymentMethod({ method_name: name })
    newMethodName.value = ''
  } catch (error) {
    methodError.value = readMessage(error)
  }
}

function onStartRenameMethod(method) {
  methodError.value = ''
  confirmingMethodDelete.value = null
  editingMethod.value = method.name
  editMethodBuffer.value = method.method_name
}

async function onRenameMethod(method) {
  const name = editMethodBuffer.value.trim()
  if (!name) return
  try {
    await expenses.savePaymentMethod({ name: method.name, method_name: name })
    editingMethod.value = null
  } catch (error) {
    methodError.value = readMessage(error)
  }
}

async function onToggleArchiveMethod(method) {
  methodError.value = ''
  try {
    await expenses.savePaymentMethod({ name: method.name, method_name: method.method_name, is_archived: method.is_archived ? 0 : 1 })
  } catch (error) {
    methodError.value = readMessage(error)
  }
}

function onConfirmMethodDelete(method) {
  methodError.value = ''
  confirmingMethodDelete.value = method.name
}

async function onDeleteMethod(method) {
  try {
    await expenses.removePaymentMethod(method.name)
    confirmingMethodDelete.value = null
  } catch (error) {
    confirmingMethodDelete.value = null
    methodError.value = readMessage(error)
  }
}

// --- settings: rules ---

function onNewRule() {
  ruleError.value = ''
  confirmingRuleDelete.value = null
  ruleForm.value = {
    name: null,
    rule_name: '',
    match_field: 'merchant',
    match_type: 'contains',
    pattern: '',
    category: '',
  }
}

function onEditRule(rule) {
  ruleError.value = ''
  confirmingRuleDelete.value = null
  ruleForm.value = {
    name: rule.name,
    rule_name: rule.rule_name || '',
    match_field: rule.match_field || 'merchant',
    match_type: rule.match_type || 'contains',
    pattern: rule.pattern || '',
    category: rule.category || '',
  }
}

async function onSaveRule() {
  ruleError.value = ''
  try {
    await expenses.saveRule({ ...ruleForm.value, name: ruleForm.value.name || undefined })
    ruleForm.value = null
  } catch (error) {
    ruleError.value = readMessage(error)
  }
}

async function onDeleteRule(rule) {
  try {
    await expenses.removeRule(rule.name)
    confirmingRuleDelete.value = null
  } catch (error) {
    confirmingRuleDelete.value = null
    ruleError.value = readMessage(error)
  }
}

function readMessage(error) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || 'Something went wrong. Please try again.'
}
</script>
