<template>
  <!--
    What the site is, above the links in the brand menu. `Menu` wraps every option in its Item
    primitive, so this is registered as a `disabled` component option: that is what keeps it out
    of the arrow-key order and unselectable while still letting it render as a row.
  -->
  <div class="border-b border-outline-gray-2 px-3 py-3">
    <p class="text-sm font-semibold text-ink-gray-9">Free tools, no account</p>
    <p class="pt-1 text-xs leading-5 text-ink-gray-5">
      Nothing you type is stored on a server. Your settings stay in this browser.
    </p>
    <p class="pt-2 text-xs leading-5 text-ink-gray-5">
      Made by
      <a
        class="font-medium text-ink-gray-7 underline underline-offset-2"
        href="https://frappe.io"
        target="_blank"
        rel="noreferrer"
        >Frappe</a
      >.
    </p>
  </div>
</template>
