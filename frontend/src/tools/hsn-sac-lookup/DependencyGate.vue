<template>
  <section
    class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-6 sm:p-8"
    aria-labelledby="dependency-heading"
  >
    <div class="flex items-start gap-4">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-gray-3">
        <LoadingIndicator v-if="dependency.state === 'installing'" class="size-5 text-ink-gray-6" />
        <Icon v-else :name="stateIcon" class="size-5 text-ink-gray-6" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 id="dependency-heading" class="text-lg font-semibold text-ink-gray-9">
            {{ dependency.title }}
          </h2>
          <Badge theme="gray" :label="dependency.state" />
        </div>
        <p class="max-w-2xl pt-2 text-sm leading-6 text-ink-gray-6">
          {{ dependency.message }}
        </p>
      </div>
    </div>

    <div class="pt-6">
      <h3 class="text-sm font-medium text-ink-gray-8">Required site apps</h3>
      <dl class="grid max-w-xl gap-3 pt-3 sm:grid-cols-2">
        <div class="rounded-xl bg-surface-base px-4 py-3">
          <dt class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Foundation</dt>
          <dd class="pt-1 text-sm font-medium text-ink-gray-9">ERPNext</dd>
        </div>
        <div class="rounded-xl bg-surface-base px-4 py-3">
          <dt class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">HSN master</dt>
          <dd class="pt-1 text-sm font-medium text-ink-gray-9">India Compliance</dd>
        </div>
      </dl>
    </div>

    <label
      v-if="dependency.state === 'installable'"
      class="mt-6 flex max-w-2xl cursor-pointer items-start gap-3 rounded-xl border border-outline-gray-2 bg-surface-base p-4"
    >
      <input
        :checked="installConfirmed"
        class="mt-0.5 size-4"
        type="checkbox"
        @change="$emit('update:installConfirmed', $event.target.checked)"
      />
      <span class="text-sm leading-6 text-ink-gray-7">
        I confirm that Toolbox can request the fixed <strong>India Compliance</strong> Marketplace app for this site.
      </span>
    </label>

    <p v-if="dependency.state === 'unsupported'" class="max-w-2xl pt-5 text-sm leading-6 text-ink-gray-6">
      The bench administrator can follow the
      <a
        class="font-medium text-ink-gray-8 underline underline-offset-4"
        :href="dependency.adminHandoff?.docsUrl"
        target="_blank"
        rel="noreferrer"
      >India Compliance installation guide</a>.
      Toolbox does not run host commands from the browser.
    </p>

    <div class="flex flex-wrap gap-2 pt-6">
      <Button
        v-if="dependency.state === 'installable'"
        label="Install India Compliance"
        variant="solid"
        :disabled="!installConfirmed"
        @click="$emit('install')"
      />
      <Button
        v-if="dependency.state === 'failed'"
        label="Retry dependency check"
        variant="solid"
        @click="$emit('retry')"
      />
      <Button
        v-if="hasSnapshot && dependency.state !== 'installing'"
        label="Use saved snapshot"
        variant="subtle"
        @click="$emit('use-snapshot')"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, Button, Icon, LoadingIndicator } from 'frappe-ui'

const props = defineProps({
  dependency: { type: Object, required: true },
  hasSnapshot: { type: Boolean, default: false },
  installConfirmed: { type: Boolean, default: false },
})

defineEmits(['install', 'retry', 'use-snapshot', 'update:installConfirmed'])

const stateIcon = computed(
  () =>
    ({
      blocked: 'lucide-shield-alert',
      installable: 'lucide-cloud-download',
      ready: 'lucide-circle-check',
      failed: 'lucide-triangle-alert',
      unsupported: 'lucide-server-off',
    })[props.dependency.state] ?? 'lucide-info',
)
</script>
