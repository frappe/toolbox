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
      <div class="overflow-x-auto">
        <TabButtons
          :options="viewTabs"
          :model-value="expenses.view.value"
          size="md"
          aria-label="Expenses sections"
          @update:model-value="onSetView"
        />
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

          <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4" aria-labelledby="dash-budget">
            <div class="flex items-center justify-between gap-3">
              <h2 id="dash-budget" class="text-sm font-semibold text-ink-gray-8">Budget</h2>
              <Button variant="subtle" :icon="showBudgetForm ? 'lucide-x' : 'lucide-plus'" :label="showBudgetForm ? 'Close' : 'Set budget'" @click="onToggleBudgetForm" />
            </div>

            <form v-if="showBudgetForm" class="mt-3 flex flex-col gap-3 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-3" aria-label="Set budget" @submit.prevent="onSetBudget">
              <div class="grid gap-3 sm:grid-cols-3">
                <FormControl
                  id="budget-category"
                  type="select"
                  size="md"
                  label="Category"
                  :model-value="budgetForm.category"
                  :options="budgetCategoryOptions"
                  @update:model-value="budgetForm.category = $event"
                />
                <FormControl
                  id="budget-amount"
                  type="number"
                  size="md"
                  label="Amount"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :model-value="budgetForm.amount"
                  @update:model-value="budgetForm.amount = $event"
                />
                <FormControl
                  id="budget-currency"
                  type="text"
                  size="md"
                  label="Currency"
                  spellcheck="false"
                  placeholder="e.g. INR"
                  :model-value="budgetForm.currency"
                  @update:model-value="budgetForm.currency = $event"
                />
              </div>
              <ErrorMessage :message="budgetError" />
              <div class="flex items-center gap-2">
                <Button variant="solid" type="submit" label="Save budget" />
                <Button variant="ghost" label="Cancel" @click="showBudgetForm = false" />
              </div>
            </form>

            <div v-if="budget && budget.overall" class="mt-4">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm text-ink-gray-7">Overall</span>
                <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(budget.overall.spent, budget.currency) }} of {{ formatMoney(budget.overall.budget, budget.currency) }}</span>
              </div>
              <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                <div class="h-full rounded-full transition-all motion-reduce:transition-none" :class="budgetBarClass(budget.overall.pct)" :style="{ width: `${Math.min(100, budget.overall.pct || 0)}%` }" />
              </div>
            </div>

            <ul v-if="budget && budget.categories && budget.categories.length" class="mt-4 flex flex-col gap-3">
              <li v-for="item in budget.categories" :key="item.category || 'overall'">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="min-w-0 truncate text-sm text-ink-gray-7">{{ item.category_name }}</span>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <span class="text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(item.spent, budget.currency) }} of {{ formatMoney(item.budget, budget.currency) }}</span>
                    <Button variant="ghost" icon="lucide-trash-2" :aria-label="`Delete ${item.category_name} budget`" @click="onDeleteBudget(budgetRowName(item.category))" />
                  </div>
                </div>
                <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                  <div class="h-full rounded-full transition-all motion-reduce:transition-none" :class="budgetBarClass(item.pct)" :style="{ width: `${Math.min(100, item.pct || 0)}%` }" />
                </div>
              </li>
            </ul>

            <p v-if="!budgetHasData" class="mt-3 text-sm text-ink-gray-5">No budgets set for this month.</p>
          </section>

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
            <TextInput
              type="search"
              size="md"
              class="min-w-0 flex-1"
              placeholder="Search expenses"
              aria-label="Search expenses"
              spellcheck="false"
              :model-value="expenses.filters.search"
              @update:model-value="expenses.setSearch"
            >
              <template #prefix>
                <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
              </template>
            </TextInput>
            <div class="flex items-center gap-2">
              <Button variant="solid" icon="lucide-plus" label="Add expense" @click="onNewExpense" />
              <Dropdown :options="exportOptions">
                <Button variant="outline" icon="lucide-download" label="Export" />
              </Dropdown>
            </div>
          </div>

          <!-- Filters -->
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FormControl
              id="filter-category"
              type="select"
              size="sm"
              label="Category"
              :model-value="expenses.filters.category"
              :options="filterCategoryOptions"
              @update:model-value="setFilter('category', $event)"
            />
            <FormControl
              id="filter-method"
              type="select"
              size="sm"
              label="Payment method"
              :model-value="expenses.filters.payment_method"
              :options="filterMethodOptions"
              @update:model-value="setFilter('payment_method', $event)"
            />
            <FormControl
              id="filter-project"
              type="select"
              size="sm"
              label="Trip"
              :model-value="expenses.filters.project_or_trip"
              :options="filterTripOptions"
              @update:model-value="setFilter('project_or_trip', $event)"
            />
            <FormControl
              id="filter-currency"
              type="text"
              size="sm"
              label="Currency"
              placeholder="Any"
              spellcheck="false"
              :model-value="expenses.filters.currency"
              @update:model-value="setFilter('currency', $event)"
            />
            <FormControl
              id="filter-from"
              type="date"
              size="sm"
              label="From"
              :model-value="expenses.filters.from_date"
              @update:model-value="setFilter('from_date', $event)"
            />
            <FormControl
              id="filter-to"
              type="date"
              size="sm"
              label="To"
              :model-value="expenses.filters.to_date"
              @update:model-value="setFilter('to_date', $event)"
            />
            <FormControl
              id="filter-sort"
              type="select"
              size="sm"
              label="Sort"
              :model-value="expenses.filters.sort"
              :options="sortOptions"
              @update:model-value="setFilter('sort', $event)"
            />
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
              <FormControl
                id="expense-amount"
                type="number"
                size="md"
                label="Amount"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
                :model-value="form.amount"
                @update:model-value="form.amount = $event"
              />
              <FormControl
                id="expense-currency"
                type="select"
                size="md"
                label="Currency"
                :model-value="form.currency"
                :options="currencyOptions"
                @update:model-value="form.currency = $event"
              />
            </div>

            <FormControl
              id="expense-date"
              type="date"
              size="md"
              label="Date"
              :model-value="form.expense_date"
              @update:model-value="form.expense_date = $event"
            />

            <FormControl
              id="expense-description"
              type="text"
              size="md"
              label="Description"
              required
              placeholder="What was this for?"
              :model-value="form.description"
              @update:model-value="(value) => { form.description = value; expenses.requestSuggestion() }"
            />

            <FormControl
              id="expense-merchant"
              type="text"
              size="md"
              label="Merchant"
              placeholder="Where did you spend it? (optional)"
              :model-value="form.merchant"
              @update:model-value="(value) => { form.merchant = value; expenses.requestSuggestion() }"
            />

            <div class="flex flex-col gap-1.5">
              <FormControl
                id="expense-category"
                type="select"
                size="md"
                label="Category"
                :model-value="form.category"
                :options="formCategoryOptions"
                @update:model-value="(value) => { form.category = value; expenses.markCategoryTouched() }"
              />
              <p v-if="expenses.suggestion.value" class="text-xs leading-5 text-ink-gray-5">
                <Icon name="lucide-sparkles" class="mr-0.5 inline size-3.5 align-text-bottom" aria-hidden="true" />{{ confidenceLabel(expenses.suggestion.value.confidence) }} · {{ expenses.suggestion.value.explanation }}
              </p>
            </div>

            <FormControl
              id="expense-method"
              type="select"
              size="md"
              label="Payment method"
              :model-value="form.payment_method"
              :options="formMethodOptions"
              @update:model-value="form.payment_method = $event"
            />

            <FormControl
              id="expense-project"
              type="select"
              size="md"
              label="Trip or project"
              :model-value="form.project_or_trip"
              :options="formTripOptions"
              @update:model-value="form.project_or_trip = $event"
            />

            <details class="rounded-lg border border-outline-gray-2 bg-surface-base px-3 py-2">
              <summary class="cursor-pointer select-none text-sm font-medium text-ink-gray-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3">More details</summary>
              <div class="mt-3 flex flex-col gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <FormControl
                    id="expense-account"
                    type="text"
                    size="md"
                    label="Account label"
                    placeholder="e.g. HDFC ••4321"
                    :model-value="form.account_label"
                    @update:model-value="form.account_label = $event"
                  />
                  <FormControl
                    id="expense-reference"
                    type="text"
                    size="md"
                    label="Reference number"
                    placeholder="Optional"
                    :model-value="form.reference_number"
                    @update:model-value="form.reference_number = $event"
                  />
                </div>

                <FormControl
                  id="expense-note"
                  type="textarea"
                  size="md"
                  label="Note"
                  :rows="2"
                  placeholder="Add a note (optional)"
                  :model-value="form.note"
                  @update:model-value="form.note = $event"
                />

                <div class="grid gap-4 sm:grid-cols-2">
                  <FormControl
                    id="expense-base-currency"
                    type="text"
                    size="md"
                    label="Base currency"
                    spellcheck="false"
                    placeholder="e.g. INR"
                    :model-value="form.base_currency"
                    @update:model-value="form.base_currency = $event"
                  />
                  <FormControl
                    id="expense-conversion"
                    type="number"
                    size="md"
                    label="Conversion rate"
                    min="0"
                    step="0.0001"
                    placeholder="1.0000"
                    :model-value="form.conversion_rate"
                    @update:model-value="form.conversion_rate = $event"
                  />
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Button variant="outline" icon="lucide-refresh-cw" label="Fetch rate" @click="expenses.fetchRate()" />
                  <p v-if="expenses.fxNotice.value" class="text-xs text-ink-gray-5">{{ expenses.fxNotice.value }}</p>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-ink-gray-7">Receipt</span>
                  <p v-if="!form.name" class="text-xs text-ink-gray-5">Save the expense first, then you can attach a receipt.</p>
                  <div v-else-if="form.receipt" class="flex flex-wrap items-center gap-2">
                    <a :href="form.receipt" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm text-ink-gray-8 underline decoration-outline-gray-3 underline-offset-2 hover:text-ink-gray-9">
                      <Icon name="lucide-paperclip" class="size-4" /> View receipt
                    </a>
                    <Button variant="ghost" icon="lucide-x" label="Remove" @click="expenses.removeReceipt(form.name)" />
                  </div>
                  <input v-else type="file" accept="image/*,application/pdf" aria-label="Attach receipt" class="text-sm text-ink-gray-7 file:mr-3 file:rounded-lg file:border file:border-outline-gray-2 file:bg-surface-base file:px-3 file:py-1.5 file:text-sm file:text-ink-gray-8" @change="onReceiptSelected" />
                </div>
              </div>
            </details>

            <TagInput variant="subtle" :model-value="form.tags" label="Tags" placeholder="Add a tag…" @update:model-value="form.tags = $event" />
          </div>

          <p class="sr-only" role="status" aria-live="polite">{{ savingStatus }}</p>
          <ErrorMessage class="mt-4" :message="expenses.saveError.value" />

          <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-outline-gray-2 pt-4">
            <Button variant="solid" type="submit" :loading="expenses.saving.value" :label="expenses.saving.value ? 'Saving…' : 'Save expense'" />
            <Button v-if="expenses.canLearnRule.value" variant="outline" icon="lucide-wand-2" :loading="expenses.saving.value" label="Save & remember merchant" @click="onSaveAndLearn" />
            <Button variant="ghost" label="Cancel" @click="expenses.closeForm()" />
            <span v-if="expenses.canLearnRule.value" class="text-xs text-ink-gray-5">Remembering auto-categorises this merchant next time.</span>
          </div>
        </form>

        <!-- Bulk actions -->
        <div v-if="expenses.selectedCount.value > 0" class="sticky bottom-4 z-20 mt-6 rounded-2xl border border-outline-gray-2 bg-surface-base p-3 shadow-lg" role="region" aria-label="Bulk actions">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-ink-gray-9" aria-live="polite">{{ expenses.selectedCount.value }} selected</span>
            <div class="flex flex-1 flex-wrap items-center gap-2">
              <FormControl
                type="select"
                size="sm"
                class="min-w-0"
                aria-label="Set category for selected expenses"
                :model-value="bulkForm.category"
                :options="bulkCategoryOptions"
                @update:model-value="bulkForm.category = $event"
              />
              <TextInput
                type="text"
                size="sm"
                class="min-w-0 flex-1"
                placeholder="Add tag"
                aria-label="Add a tag to selected expenses"
                :model-value="bulkForm.addTag"
                @update:model-value="bulkForm.addTag = $event"
              />
              <FormControl
                type="select"
                size="sm"
                class="min-w-0"
                aria-label="Set trip for selected expenses"
                :model-value="bulkForm.project"
                :options="bulkTripOptions"
                @update:model-value="bulkForm.project = $event"
              />
              <Button variant="solid" label="Apply" @click="onBulkApply" />
            </div>
            <div class="flex items-center gap-1.5">
              <template v-if="confirmingBulkDelete">
                <span class="text-xs text-ink-gray-7">Delete selected?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingBulkDelete = false" />
                <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onBulkRemove" />
              </template>
              <Button v-else variant="ghost" icon="lucide-trash-2" label="Delete selected" @click="confirmingBulkDelete = true" />
              <Button variant="ghost" label="Clear" @click="expenses.clearSelection()" />
            </div>
          </div>
          <ErrorMessage class="mt-2" :message="bulkError" />
        </div>

        <!-- List -->
        <div class="mt-6">
          <ul v-if="expenses.expenses.value.length" class="flex flex-col gap-1.5">
            <li v-for="row in expenses.expenses.value" :key="row.name" :data-expense-name="row.name" class="rounded-xl border border-outline-gray-2 bg-surface-base p-3">
              <div class="flex items-start gap-3">
                <Checkbox
                  class="mt-1 shrink-0"
                  :model-value="expenses.isSelected(row.name)"
                  :aria-label="`Select ${row.description || 'expense'}`"
                  @update:model-value="expenses.toggleSelected(row.name)"
                />
                <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <p class="truncate text-sm font-medium text-ink-gray-9">{{ row.description || 'Expense' }}</p>
                    <span v-if="row.merchant" class="shrink-0 truncate text-xs text-ink-gray-5">{{ row.merchant }}</span>
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray-5">
                    <span>{{ row.expense_date }}</span>
                    <span v-if="row.category_name">{{ row.category_name }}</span>
                    <span v-if="row.payment_method_name">{{ row.payment_method_name }}</span>
                    <span v-if="row.project_name">{{ row.project_name }}</span>
                    <a v-if="row.receipt" :href="row.receipt" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-ink-gray-6 hover:text-ink-gray-9" :aria-label="`View receipt for ${row.description}`" @click.stop><Icon name="lucide-paperclip" class="size-3.5" /> Receipt</a>
                  </div>
                  <div v-if="row.tags && row.tags.length" class="mt-2 flex flex-wrap gap-1" role="list" aria-label="Tags">
                    <Badge v-for="tag in row.tags" :key="tag" role="listitem" theme="gray" variant="subtle" size="sm" :label="tag" />
                  </div>
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

      <!-- Trips / projects -->
      <div v-else-if="expenses.view.value === 'trips'" class="mt-6 flex flex-col gap-6">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-ink-gray-8">Trips and projects</h2>
          <Button v-if="!projectForm" variant="subtle" icon="lucide-plus" label="Add trip" @click="onNewProject" />
        </div>

        <!-- Add / edit form -->
        <form v-if="projectForm" class="flex flex-col gap-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5" aria-label="Trip details" @submit.prevent="onSaveProject">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-ink-gray-9">{{ projectForm.name ? 'Edit trip' : 'Add trip' }}</h3>
            <Button variant="ghost" icon="lucide-x" aria-label="Close form" @click="projectForm = null" />
          </div>

          <FormControl
            id="project-name"
            type="text"
            size="md"
            label="Name"
            required
            placeholder="e.g. Goa trip"
            :model-value="projectForm.project_name"
            @update:model-value="projectForm.project_name = $event"
          />

          <div class="grid gap-4 sm:grid-cols-2">
            <FormControl
              id="project-type"
              type="select"
              size="md"
              label="Type"
              :model-value="projectForm.project_type"
              :options="PROJECT_TYPES"
              @update:model-value="projectForm.project_type = $event"
            />
            <FormControl
              id="project-status"
              type="select"
              size="md"
              label="Status"
              :model-value="projectForm.status"
              :options="PROJECT_STATUSES"
              @update:model-value="projectForm.status = $event"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <FormControl
              id="project-start"
              type="date"
              size="md"
              label="Start date"
              :model-value="projectForm.start_date"
              @update:model-value="projectForm.start_date = $event"
            />
            <FormControl
              id="project-end"
              type="date"
              size="md"
              label="End date"
              :model-value="projectForm.end_date"
              @update:model-value="projectForm.end_date = $event"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <FormControl
              id="project-currency"
              type="text"
              size="md"
              label="Default currency"
              spellcheck="false"
              placeholder="e.g. INR"
              :model-value="projectForm.default_currency"
              @update:model-value="projectForm.default_currency = $event"
            />
            <FormControl
              id="project-budget"
              type="number"
              size="md"
              label="Budget"
              min="0"
              step="0.01"
              placeholder="Optional"
              :model-value="projectForm.budget"
              @update:model-value="projectForm.budget = $event"
            />
          </div>

          <FormControl
            id="project-note"
            type="textarea"
            size="md"
            label="Note"
            :rows="2"
            placeholder="Add a note (optional)"
            :model-value="projectForm.note"
            @update:model-value="projectForm.note = $event"
          />

          <ErrorMessage :message="projectError" />
          <div class="flex items-center gap-2">
            <Button variant="solid" type="submit" label="Save trip" />
            <Button variant="ghost" label="Cancel" @click="projectForm = null" />
          </div>
        </form>

        <!-- Summary panel -->
        <section v-if="summary" class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="project-summary">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 id="project-summary" class="truncate text-base font-semibold text-ink-gray-9">{{ summary.project_name }}</h3>
              <p class="mt-1 text-sm text-ink-gray-6">{{ summary.expense_count }} {{ summary.expense_count === 1 ? 'expense' : 'expenses' }}</p>
            </div>
            <Button variant="ghost" icon="lucide-x" aria-label="Close summary" @click="expenses.closeProjectSummary()" />
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl border border-outline-gray-2 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Total spent</p>
              <p class="mt-1 text-xl font-semibold tabular-nums text-ink-gray-9">{{ formatMoney(summary.total_spent, summary.base_currency) }}</p>
            </div>
            <div v-if="summary.budget" class="rounded-xl border border-outline-gray-2 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Remaining of {{ formatMoney(summary.budget, summary.base_currency) }}</p>
              <p class="mt-1 text-xl font-semibold tabular-nums text-ink-gray-9">{{ formatMoney(summary.budget_remaining, summary.base_currency) }}</p>
              <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                <div class="h-full rounded-full transition-all motion-reduce:transition-none" :class="budgetBarClass(summaryBudgetPct)" :style="{ width: `${Math.min(100, summaryBudgetPct || 0)}%` }" />
              </div>
            </div>
          </div>

          <div v-if="summary.currencies && summary.currencies.length > 1" class="mt-4">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-ink-gray-5">By currency</h4>
            <div class="mt-2 flex flex-wrap gap-2" role="list">
              <Badge
                v-for="line in summary.currencies"
                :key="line.currency"
                role="listitem"
                theme="gray"
                variant="subtle"
                size="sm"
                class="tabular-nums"
                :label="formatMoney(line.total, line.currency)"
              />
            </div>
          </div>

          <div v-if="summary.category_breakdown && summary.category_breakdown.length" class="mt-4">
            <h4 class="text-xs font-semibold uppercase tracking-wide text-ink-gray-5">By category</h4>
            <ul class="mt-2 flex flex-col gap-3">
              <li v-for="item in summary.category_breakdown" :key="item.label">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="min-w-0 truncate text-sm text-ink-gray-7">{{ item.label }}</span>
                  <span class="shrink-0 text-sm font-medium tabular-nums text-ink-gray-9">{{ formatMoney(item.amount, summary.base_currency) }}</span>
                </div>
                <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-gray-3">
                  <div class="h-full rounded-full bg-ink-gray-7 transition-all motion-reduce:transition-none" :style="{ width: `${barPct(item.amount, maxSummaryAmount)}%` }" />
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- List -->
        <ul v-if="expenses.projects.value.length" class="flex flex-col gap-1.5">
          <li v-for="project in expenses.projects.value" :key="project.name" class="rounded-xl border border-outline-gray-2 bg-surface-base px-3 py-2">
            <div class="flex flex-wrap items-center gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink-gray-9">{{ project.project_name }}</p>
                <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray-5">
                  <span>{{ project.project_type }}</span>
                  <span>{{ project.status }}</span>
                  <span v-if="project.budget">{{ formatMoney(project.budget, project.default_currency) }}</span>
                </div>
              </div>
              <Button variant="ghost" icon="lucide-pencil" aria-label="Edit trip" @click="onEditProject(project)" />
              <Button variant="ghost" icon="lucide-eye" label="View" @click="onViewProject(project.name)" />
              <template v-if="confirmingProjectDelete === project.name">
                <span class="text-xs text-ink-gray-7">Delete?</span>
                <Button variant="ghost" label="Cancel" @click="confirmingProjectDelete = null" />
                <Button variant="solid" theme="red" icon="lucide-trash-2" label="Delete" @click="onDeleteProject(project.name)" />
              </template>
              <Button v-else variant="ghost" icon="lucide-trash-2" aria-label="Delete trip" @click="confirmingProjectDelete = project.name" />
            </div>
          </li>
        </ul>
        <p v-else-if="!projectForm" class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 px-4 py-10 text-center text-sm text-ink-gray-6">No trips or projects yet.</p>
      </div>

      <!-- Settings -->
      <div v-else class="mt-6 flex flex-col gap-6">
        <!-- Categories -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-categories">
          <h2 id="settings-categories" class="text-sm font-semibold text-ink-gray-8">Categories</h2>
          <ul class="mt-3 flex flex-col gap-1.5">
            <li v-for="cat in expenses.categories.value" :key="cat.name" class="rounded-xl border border-outline-gray-2 px-3 py-2" :class="{ 'opacity-70': cat.is_archived }">
              <div v-if="editingCategory === cat.name" class="flex flex-wrap items-center gap-2">
                <TextInput
                  size="sm"
                  class="min-w-0 flex-1"
                  :aria-label="`Rename ${cat.category_name}`"
                  :model-value="editCategoryBuffer"
                  @update:model-value="editCategoryBuffer = $event"
                  @keydown.enter.prevent="onRenameCategory(cat)"
                />
                <Button variant="solid" label="Save" @click="onRenameCategory(cat)" />
                <Button variant="ghost" label="Cancel" @click="editingCategory = null" />
              </div>
              <div v-else class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ cat.category_name }}</span>
                <Badge v-if="cat.is_archived" class="shrink-0" theme="gray" variant="subtle" size="sm" label="Archived" />
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
            <TextInput
              size="md"
              class="min-w-0 flex-1"
              placeholder="Add a category"
              aria-label="Add a category"
              :model-value="newCategoryName"
              @update:model-value="newCategoryName = $event"
            />
            <Button variant="subtle" icon="lucide-plus" label="Add" type="submit" />
          </form>
          <ErrorMessage class="mt-3" :message="categoryError" />
        </section>

        <!-- Payment methods -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-methods">
          <h2 id="settings-methods" class="text-sm font-semibold text-ink-gray-8">Payment methods</h2>
          <ul class="mt-3 flex flex-col gap-1.5">
            <li v-for="method in expenses.paymentMethods.value" :key="method.name" class="rounded-xl border border-outline-gray-2 px-3 py-2" :class="{ 'opacity-70': method.is_archived }">
              <div v-if="editingMethod === method.name" class="flex flex-wrap items-center gap-2">
                <TextInput
                  size="sm"
                  class="min-w-0 flex-1"
                  :aria-label="`Rename ${method.method_name}`"
                  :model-value="editMethodBuffer"
                  @update:model-value="editMethodBuffer = $event"
                  @keydown.enter.prevent="onRenameMethod(method)"
                />
                <Button variant="solid" label="Save" @click="onRenameMethod(method)" />
                <Button variant="ghost" label="Cancel" @click="editingMethod = null" />
              </div>
              <div v-else class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ method.method_name }}</span>
                <Badge v-if="method.is_archived" class="shrink-0" theme="gray" variant="subtle" size="sm" label="Archived" />
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
            <TextInput
              size="md"
              class="min-w-0 flex-1"
              placeholder="Add a payment method"
              aria-label="Add a payment method"
              :model-value="newMethodName"
              @update:model-value="newMethodName = $event"
            />
            <Button variant="subtle" icon="lucide-plus" label="Add" type="submit" />
          </form>
          <ErrorMessage class="mt-3" :message="methodError" />
        </section>

        <!-- Rules -->
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-base p-4 sm:p-5" aria-labelledby="settings-rules">
          <div class="flex items-center justify-between gap-3">
            <h2 id="settings-rules" class="text-sm font-semibold text-ink-gray-8">Auto-categorisation rules</h2>
            <Button v-if="!ruleForm" variant="subtle" icon="lucide-plus" label="Add rule" @click="onNewRule" />
          </div>

          <form v-if="ruleForm" class="mt-3 flex flex-col gap-3 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-3" aria-label="Rule details" @submit.prevent="onSaveRule">
            <FormControl
              id="rule-name"
              type="text"
              size="md"
              label="Rule name"
              required
              placeholder="e.g. Uber rides"
              :model-value="ruleForm.rule_name"
              @update:model-value="ruleForm.rule_name = $event"
            />
            <div class="grid gap-3 sm:grid-cols-2">
              <FormControl
                id="rule-field"
                type="select"
                size="md"
                label="Match field"
                :model-value="ruleForm.match_field"
                :options="matchFieldOptions"
                @update:model-value="ruleForm.match_field = $event"
              />
              <FormControl
                id="rule-type"
                type="select"
                size="md"
                label="Match type"
                :model-value="ruleForm.match_type"
                :options="matchTypeOptions"
                @update:model-value="ruleForm.match_type = $event"
              />
            </div>
            <FormControl
              id="rule-pattern"
              type="text"
              size="md"
              label="Pattern"
              required
              placeholder="Text to match"
              :model-value="ruleForm.pattern"
              @update:model-value="ruleForm.pattern = $event"
            />
            <FormControl
              id="rule-category"
              type="select"
              size="md"
              label="Category"
              required
              :model-value="ruleForm.category"
              :options="formCategoryOptions"
              @update:model-value="ruleForm.category = $event"
            />
            <ErrorMessage :message="ruleError" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  ErrorMessage,
  FormControl,
  Icon,
  TabButtons,
  TextInput,
} from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import TagInput from '@/components/inputs/TagInput.vue'
import { confidenceLabel, formatMoney, useExpenses } from '@/tools/expenses/useExpenses'

const TOOL_ID = 'expenses'

const preferences = useToolboxPreferences()
const expenses = useExpenses({ defaultCurrency: preferences.settings?.defaultCurrency || 'INR' })

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

// Trips / projects
let projectsLoaded = false
const projectForm = ref(null)
const confirmingProjectDelete = ref(null)
const projectError = ref('')

// Dashboard: budgets
let budgetsLoaded = false
const showBudgetForm = ref(false)
const budgetForm = reactive({ category: '', amount: '', currency: '' })
const budgetError = ref('')

// Expenses: bulk actions
const bulkForm = reactive({ category: '', addTag: '', project: '' })
const confirmingBulkDelete = ref(false)
const bulkError = ref('')

const viewTabs = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'list', label: 'Expenses' },
  { value: 'trips', label: 'Trips' },
  { value: 'settings', label: 'Settings' },
]

const PROJECT_TYPES = ['Trip', 'Project']
const PROJECT_STATUSES = ['Active', 'Completed', 'Archived']

const sortOptions = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Amount: high to low' },
  { value: 'amount_asc', label: 'Amount: low to high' },
]

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD']

const matchFieldOptions = [
  { label: 'Merchant', value: 'merchant' },
  { label: 'Description', value: 'description' },
  { label: 'Merchant + description', value: 'combined' },
]
const matchTypeOptions = [
  { label: 'Exact', value: 'exact' },
  { label: 'Contains', value: 'contains' },
  { label: 'Starts with', value: 'starts_with' },
  { label: 'Regex', value: 'regex' },
]

const exportOptions = [
  { label: 'JSON', onClick: () => onExport('json') },
  { label: 'CSV', onClick: () => onExport('csv') },
]

// Select option lists. A base list per record type, plus the leading option
// ('Overall', 'All …', 'None', 'Set …') that each picker prepends.
const categoryOptions = computed(() =>
  expenses.activeCategories.value.map((cat) => ({ label: cat.category_name, value: cat.name })),
)
const methodOptions = computed(() =>
  expenses.paymentMethods.value.map((method) => ({ label: method.method_name, value: method.name })),
)
const tripOptions = computed(() =>
  expenses.projects.value.map((project) => ({ label: project.project_name, value: project.name })),
)

const budgetCategoryOptions = computed(() => [{ label: 'Overall', value: '' }, ...categoryOptions.value])
const filterCategoryOptions = computed(() => [{ label: 'All categories', value: '' }, ...categoryOptions.value])
const filterMethodOptions = computed(() => [{ label: 'All methods', value: '' }, ...methodOptions.value])
const filterTripOptions = computed(() => [{ label: 'All trips', value: '' }, ...tripOptions.value])
const formCategoryOptions = computed(() => [{ label: 'Select a category', value: '' }, ...categoryOptions.value])
const formMethodOptions = computed(() => [{ label: 'None', value: '' }, ...methodOptions.value])
const formTripOptions = computed(() => [{ label: 'None', value: '' }, ...tripOptions.value])
const bulkCategoryOptions = computed(() => [{ label: 'Set category…', value: '' }, ...categoryOptions.value])
const bulkTripOptions = computed(() => [{ label: 'Set trip…', value: '' }, ...tripOptions.value])

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
  return Boolean(
    f.search || f.category || f.payment_method || f.project_or_trip || f.currency || f.from_date || f.to_date,
  )
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

const budget = computed(() => expenses.budgetData.value)
const budgetHasData = computed(() => Boolean(budget.value && (budget.value.overall || budget.value.categories?.length)))

const summary = computed(() => expenses.activeProjectSummary.value)
const maxSummaryAmount = computed(() =>
  Math.max(0, ...(summary.value?.category_breakdown || []).map((c) => c.amount || 0)),
)
const summaryBudgetPct = computed(() => {
  const s = summary.value
  if (!s || !s.budget) return null
  return (s.total_spent / s.budget) * 100
})

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

// Structured filters apply immediately on change; the search box debounces on its own.
function setFilter(key, value) {
  expenses.filters[key] = value
  expenses.applyFilters()
}

function onSetView(next) {
  confirmingExpenseDelete.value = null
  confirmingBulkDelete.value = false
  confirmingProjectDelete.value = null
  expenses.view.value = next
  if (next === 'settings' && !rulesLoaded) {
    rulesLoaded = true
    void expenses.loadRules()
  }
  // Projects already load on mount; reload once on first visit to stay safe if that failed.
  if (next === 'trips' && !projectsLoaded) {
    projectsLoaded = true
    void expenses.loadProjects()
  }
  // Budget names (for deletion) live in `budgets`, loaded lazily the first time we show them.
  if (next === 'dashboard' && !budgetsLoaded) {
    budgetsLoaded = true
    void expenses.loadBudgets()
  }
}

function onNewExpense() {
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
  if (format === 'json') void expenses.exportJson()
  else void expenses.exportCsv()
}

async function onSave() {
  await expenses.saveActive()
}

async function onReceiptSelected(event) {
  const file = event.target.files && event.target.files[0]
  if (file && form.value) await expenses.attachReceipt(form.value.name, file)
  event.target.value = ''
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

// --- trips / projects ---

function onNewProject() {
  projectError.value = ''
  confirmingProjectDelete.value = null
  expenses.closeProjectSummary()
  projectForm.value = {
    name: null,
    project_name: '',
    project_type: 'Trip',
    status: 'Active',
    start_date: '',
    end_date: '',
    default_currency: '',
    budget: '',
    note: '',
  }
}

function onEditProject(project) {
  projectError.value = ''
  confirmingProjectDelete.value = null
  projectForm.value = {
    name: project.name,
    project_name: project.project_name || '',
    project_type: project.project_type || 'Trip',
    status: project.status || 'Active',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    default_currency: project.default_currency || '',
    budget: project.budget ?? '',
    note: project.note || '',
  }
}

async function onSaveProject() {
  const f = projectForm.value
  if (!f.project_name.trim()) {
    projectError.value = 'Give this trip a name.'
    return
  }
  projectError.value = ''
  try {
    await expenses.saveProject({
      name: f.name || undefined,
      project_name: f.project_name.trim(),
      project_type: f.project_type,
      status: f.status,
      start_date: f.start_date || '',
      end_date: f.end_date || '',
      default_currency: f.default_currency || '',
      budget: f.budget === '' ? '' : Number(f.budget),
      note: f.note || '',
    })
    projectForm.value = null
  } catch (error) {
    projectError.value = readMessage(error)
  }
}

function onViewProject(name) {
  projectError.value = ''
  void expenses.openProjectSummary(name)
}

async function onDeleteProject(name) {
  try {
    await expenses.removeProject(name)
    confirmingProjectDelete.value = null
  } catch (error) {
    confirmingProjectDelete.value = null
    projectError.value = readMessage(error)
  }
}

// --- dashboard: budgets ---

function budgetBarClass(pct) {
  return (pct || 0) > 100 ? 'bg-ink-red-4' : 'bg-ink-gray-7'
}

// The progress rows come from `budgetData` (display only); the deletable `name` lives in `budgets`.
function budgetRowName(categoryId) {
  const match = expenses.budgets.value.find((b) => (b.category || null) === (categoryId || null))
  return match ? match.name : null
}

function onToggleBudgetForm() {
  budgetError.value = ''
  showBudgetForm.value = !showBudgetForm.value
  if (showBudgetForm.value) {
    budgetForm.currency = dash.value?.currency || ''
    void expenses.loadBudgets()
  }
}

async function onSetBudget() {
  const amount = Number(budgetForm.amount)
  if (!amount || amount <= 0) {
    budgetError.value = 'Enter a budget amount greater than zero.'
    return
  }
  budgetError.value = ''
  const payload = {
    month: dash.value?.month,
    year: dash.value?.year,
    budget_amount: amount,
    currency: budgetForm.currency || dash.value?.currency || '',
  }
  if (budgetForm.category) payload.category = budgetForm.category
  try {
    await expenses.setBudget(payload)
    budgetForm.category = ''
    budgetForm.amount = ''
    showBudgetForm.value = false
  } catch (error) {
    budgetError.value = readMessage(error)
  }
}

async function onDeleteBudget(name) {
  if (!name) return
  budgetError.value = ''
  try {
    await expenses.removeBudget(name)
  } catch (error) {
    budgetError.value = readMessage(error)
  }
}

// --- expenses: bulk actions ---

async function onBulkApply() {
  bulkError.value = ''
  const payload = {}
  if (bulkForm.category) payload.category = bulkForm.category
  if (bulkForm.addTag.trim()) payload.addTag = bulkForm.addTag.trim()
  if (bulkForm.project) payload.project = bulkForm.project
  try {
    await expenses.bulkApply(payload)
    bulkForm.category = ''
    bulkForm.addTag = ''
    bulkForm.project = ''
  } catch (error) {
    bulkError.value = readMessage(error)
  }
}

async function onBulkRemove() {
  bulkError.value = ''
  try {
    await expenses.bulkRemove()
    confirmingBulkDelete.value = false
  } catch (error) {
    confirmingBulkDelete.value = false
    bulkError.value = readMessage(error)
  }
}

function readMessage(error) {
  if (Array.isArray(error?.messages) && error.messages.length) return error.messages[0]
  return error?.message || 'Something went wrong. Please try again.'
}
</script>
