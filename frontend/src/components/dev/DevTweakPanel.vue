<template>
  <section
    class="fixed bottom-4 right-4 z-30 w-60 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-3 shadow-xl"
    aria-label="Development layout controls"
  >
    <div class="flex items-center gap-2">
      <Icon name="lucide-sliders-horizontal" class="size-4 text-ink-gray-6" />
      <h2 class="text-sm font-medium text-ink-gray-9">Tweak layout</h2>
      <Button
        class="ml-auto"
        variant="ghost"
        :icon="expanded ? 'lucide-chevron-down' : 'lucide-chevron-up'"
        :aria-label="expanded ? 'Collapse layout controls' : 'Expand layout controls'"
        @click="expanded = !expanded"
      />
    </div>
    <div v-if="expanded" class="space-y-3 pt-3">
      <TweakOption
        label="Density"
        :options="['comfortable', 'compact']"
        :value="layout.density"
        @change="layout.density = $event"
      />
      <TweakOption
        label="Surface"
        :options="['soft', 'flush']"
        :value="layout.surface"
        @change="layout.surface = $event"
      />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useLayoutPreferences } from '@/composables/useLayoutPreferences'
import TweakOption from './TweakOption.vue'

const expanded = ref(true)
const layout = useLayoutPreferences()
</script>
