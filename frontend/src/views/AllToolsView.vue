<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
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
          <!-- ink-gray-4 is #999999, which is 2.84:1 on the page background and fails WCAG AA.
               The count says how many tools a category holds, so it has to be readable. -->
          <span class="text-sm text-ink-gray-6">{{ group.tools.length }}</span>
        </div>
        <!-- A row for each tool rather than a card. Thirty-four bordered boxes is a page a
             visitor scrolls past, and a hover tint shows the target just as well.

             The row carries `min-w-0` as well as the text column inside it. A grid item gets
             `min-width: auto`, so without it the row cannot shrink below its own content and grows
             past its column: 440px inside a 343px column on a 375px phone. The shell clips rather
             than scrolls, so the description was cut mid-word and `truncate` never fired, because
             the paragraph believed it had the room. -->
        <div class="grid gap-1 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink
            v-for="tool in group.tools"
            :key="tool.id"
            :to="tool.route"
            data-tool-card
            class="group flex min-w-0 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          >
            <!-- The tile and the row hover share a token, so the tile takes the next step up on
                 hover. Without that it disappears into the row it sits on. -->
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-gray-2 transition-colors group-hover:bg-surface-gray-3"
            >
              <Icon :name="tool.icon" class="size-4 text-ink-gray-7" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-sm font-medium text-ink-gray-9">{{ tool.name }}</h3>
                <Badge v-if="!isToolAvailable(tool)" theme="gray" label="Validating" />
              </div>
              <p class="truncate text-xs leading-5 text-ink-gray-6">{{ tool.summary }}</p>
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
