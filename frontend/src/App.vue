<template>
  <FrappeUIProvider>
    <AppShell>
      <router-view />
      <ToolContentSection />
    </AppShell>
    <DevTweakPanel v-if="isDevelopment" />
  </FrappeUIProvider>
</template>

<script setup>
import { FrappeUIProvider } from 'frappe-ui'

import AppShell from '@/components/layout/AppShell.vue'
import ToolContentSection from '@/components/content/ToolContentSection.vue'
import DevTweakPanel from '@/components/dev/DevTweakPanel.vue'
import { useTheme } from '@/composables/useTheme'

const isDevelopment = import.meta.env.DEV

useTheme()
</script>
