<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header>
      <p class="text-sm font-medium text-ink-gray-5">Browse</p>
      <h1 class="pt-2 text-3xl font-semibold tracking-tight text-ink-gray-9">All tools</h1>
      <p class="pt-2 text-base text-ink-gray-6">Pick a tool to get started.</p>
    </header>

    <div class="space-y-10 pt-8">
      <section v-for="group in groupedTools" :key="group.category.id">
        <div class="flex items-center gap-2 px-1">
          <Icon :name="group.category.icon" class="size-4 text-ink-gray-5" />
          <h2 class="text-sm font-semibold text-ink-gray-8">{{ group.category.name }}</h2>
          <span class="text-sm text-ink-gray-4">{{ group.tools.length }}</span>
        </div>
        <div class="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="tool in group.tools"
            :key="tool.id"
            :to="tool.route"
            data-tool-card
            class="group flex flex-col gap-3 rounded-2xl border border-outline-gray-2 bg-surface-base p-5 transition hover:border-outline-gray-3 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          >
            <span class="flex size-11 items-center justify-center rounded-xl bg-surface-gray-2">
              <Icon :name="tool.icon" class="size-5 text-ink-gray-7" />
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-ink-gray-9">{{ tool.name }}</h3>
                <Badge v-if="!isToolAvailable(tool)" theme="gray" label="Validating" />
              </div>
              <p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ tool.description }}</p>
            </div>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { Badge, Icon } from 'frappe-ui'
import { RouterLink } from 'vue-router'

import { isToolAvailable, toolCategories, tools } from '@/data/toolRegistry'

const groupedTools = toolCategories
  .map((category) => ({
    category,
    tools: tools.filter((tool) => tool.category === category.id),
  }))
  .filter((group) => group.tools.length)
</script>
