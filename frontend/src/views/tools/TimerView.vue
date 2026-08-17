<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      :icon="tool.icon"
      :category="categoryName"
      :title="tool.name"
      :description="tool.description"
    />

    <div class="pt-8">
      <section v-if="variant === 'timer'" aria-labelledby="timer-heading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6">
          <h2 id="timer-heading" class="text-lg font-semibold text-ink-gray-9">Timer</h2>
          <div class="grid gap-4 pt-5 sm:grid-cols-2">
            <FormControl type="number" size="md" label="Minutes" min="1" max="1440" :model-value="timerMinutes" @update:model-value="timerMinutes = $event" />
            <FormControl type="text" size="md" label="Label (optional)" maxlength="80" placeholder="Tea break" :model-value="timerLabel" @update:model-value="timerLabel = $event" />
          </div>
          <div class="flex flex-wrap gap-2 pt-6"><Button label="Set timer" icon-left="lucide-timer" variant="subtle" class="h-12" @click="setTimer" /><Button :label="timerAction" :icon-left="timerActionIcon" variant="solid" class="h-12" :disabled="!workspace.state.timer.durationMs" @click="workspace.toggleTimer" /><Button label="Reset" icon-left="lucide-rotate-ccw" variant="outline" class="h-12" @click="workspace.resetActiveTimer" /></div>
        </div>
        <TimeDisplay :label="workspace.state.timer.label || 'Timer remaining'" :milliseconds="workspace.state.timer.remainingMs" :status="workspace.state.timer.status" />
      </section>

      <section v-else-if="variant === 'stopwatch'" aria-labelledby="stopwatch-heading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6">
          <h2 id="stopwatch-heading" class="text-lg font-semibold text-ink-gray-9">Stopwatch</h2>
          <div class="flex flex-wrap gap-2 pt-6"><Button :label="stopwatchAction" :icon-left="stopwatchActionIcon" variant="solid" class="h-12" @click="workspace.toggleStopwatch" /><Button label="Lap" icon-left="lucide-flag" variant="outline" class="h-12" :disabled="workspace.state.stopwatch.status !== 'running'" @click="workspace.lap" /><Button label="Reset" icon-left="lucide-rotate-ccw" variant="outline" class="h-12" @click="workspace.resetStopwatch" /></div>
          <ol v-if="workspace.state.stopwatch.laps.length" class="grid gap-2 pt-6" aria-label="Lap times"><li v-for="(lap, index) in [...workspace.state.stopwatch.laps].reverse()" :key="lap.elapsedMs" class="flex items-center justify-between rounded-lg bg-surface-gray-2 px-3 py-2 text-sm"><span>Lap {{ workspace.state.stopwatch.laps.length - index }}</span><span class="font-mono text-ink-gray-8">{{ formatDuration(lap.splitMs, true) }} · {{ formatDuration(lap.elapsedMs, true) }}</span></li></ol>
        </div>
        <TimeDisplay label="Elapsed time" :milliseconds="stopwatchElapsed" :status="workspace.state.stopwatch.status" precise />
      </section>

      <section v-else aria-labelledby="countdown-heading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6">
          <h2 id="countdown-heading" class="text-lg font-semibold text-ink-gray-9">Countdown</h2>
          <div class="grid gap-5 pt-5">
            <div class="grid gap-2"><p id="countdown-mode-label" class="text-sm font-medium text-ink-gray-7">Countdown mode</p><TabButtons v-model="countdownMode" :options="countdownModes" size="md" aria-labelledby="countdown-mode-label" /></div>
            <FormControl v-if="countdownMode === 'duration'" type="number" size="md" label="Duration in minutes" min="1" max="525600" :model-value="countdownMinutes" @update:model-value="countdownMinutes = $event" />
            <FormControl v-else type="datetime" size="md" label="Target date and time" :model-value="countdownDate" @update:model-value="countdownDate = $event" />
          </div>
          <ErrorMessage class="pt-3" :message="countdownError" />
          <div class="flex flex-wrap gap-2 pt-6"><Button label="Start countdown" icon-left="lucide-play" variant="solid" class="h-12" @click="startCountdown" /><Button label="Clear" icon-left="lucide-x" variant="outline" class="h-12" @click="workspace.clearCountdown" /></div>
          <p v-if="workspace.state.countdown.targetAt" class="pt-5 text-sm text-ink-gray-6">Target: <time>{{ targetText }}</time></p>
        </div>
        <TimeDisplay label="Countdown remaining" :milliseconds="workspace.state.countdown.remainingMs" :status="workspace.state.countdown.status" />
      </section>
    </div>

    <!-- Outline, not the filled subtle variant. frappe-ui fills a subtle Alert with the `-2`
         surface, which is a pale tint in light mode but a saturated block in dark mode: amber-2
         is 30.3% lightness against a 23.9% page, so it read as a brown slab. The amber icon
         carries the warning on its own, and this is a standing caveat rather than an error. -->
    <Alert class="mt-8" theme="yellow" variant="outline" :dismissible="false" title="Browsers and operating systems can suspend background tabs. Toolbox restores the correct time when you return, but it cannot guarantee that an alarm sounds while suspended." />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Alert, Button, ErrorMessage, FormControl, TabButtons } from 'frappe-ui'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import TimeDisplay from '@/tools/timer/TimeDisplay.vue'
import { useTimerWorkspace } from '@/tools/timer/useTimerWorkspace'
import { formatDuration } from '@/tools/timer/formatTime'
import { getToolCategoryName } from '@/data/toolRegistry'

const countdownModes = [{ value: 'duration', label: 'Duration' }, { value: 'date', label: 'Date and time' }]
const timerMinutes = ref('5'), timerLabel = ref(''), countdownMode = ref('duration'), countdownMinutes = ref('60'), countdownDate = ref(''), countdownError = ref('')
const preferences = useToolboxPreferences(), workspace = useTimerWorkspace()
// The timer, the stopwatch and the countdown are three tools with three routes, rendered here
// together because they share one workspace: a timer keeps running while you use the stopwatch.
const { tool, variant } = useToolFamily()
const categoryName = computed(() => getToolCategoryName(tool.value?.id))
const stopwatchElapsed = workspace.stopwatchElapsed
const timerAction = computed(() => workspace.state.timer.status === 'running' ? 'Pause' : workspace.state.timer.status === 'paused' ? 'Resume' : 'Start')
const stopwatchAction = computed(() => workspace.state.stopwatch.status === 'running' ? 'Stop' : workspace.state.stopwatch.status === 'paused' ? 'Resume' : 'Start')
const timerActionIcon = computed(() => workspace.state.timer.status === 'running' ? 'lucide-pause' : 'lucide-play')
const stopwatchActionIcon = computed(() => workspace.state.stopwatch.status === 'running' ? 'lucide-square' : 'lucide-play')
const targetText = computed(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(workspace.state.countdown.targetAt))
function setTimer() { const minutes = Number(timerMinutes.value); if (minutes >= 1 && minutes <= 1440) workspace.configureTimer(minutes * 60000, timerLabel.value) }
function startCountdown() { countdownError.value = ''; const target = countdownMode.value === 'duration' ? Date.now() + Number(countdownMinutes.value) * 60000 : new Date(countdownDate.value).getTime(); if (!Number.isFinite(target) || target <= Date.now()) { countdownError.value = 'Choose a future date or a duration of at least one minute.'; return } workspace.setCountdown(target) }
// A move between the three does not remount this view, because it is the same component on a
// different route, so recording the recent tool has to follow the route rather than the mount.
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })
</script>
