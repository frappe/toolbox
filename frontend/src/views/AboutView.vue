<template>
  <!-- The page is prose, so it lives in `toolbox/content/about.md` and is rendered by the build,
       the same way a tool page's explanation is. `ToolContentSection` renders it below this, and
       the server renders it for a visitor who has no JavaScript. All this view owns is the
       heading, which the server also renders from `toolbox/seo.py`. -->
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader title="About Toolbox" description="Who makes these tools, why they are free, and what they are built on." />
  </div>
</template>

<script setup>
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
</script>
