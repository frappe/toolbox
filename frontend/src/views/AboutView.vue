<template>
  <!-- The page is prose, so it lives in `toolbox/content/about.md` and is rendered by the build,
       the same way a tool page's explanation is. `ToolContentSection` renders it below this, and
       the server renders it for a visitor who has no JavaScript. All this view owns is the
       heading, which the server also renders from `toolbox/seo.py`. -->
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-8 sm:px-8 sm:py-12">
    <h1 class="text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">About Toolbox</h1>
    <p class="text-base leading-7 text-ink-gray-6">
      Who makes these tools, why they are free, and what they are built on.
    </p>
  </div>
</template>
