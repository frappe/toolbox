<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"><Icon name="lucide-timer" class="size-6 text-ink-gray-7" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Time</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Timer, Stopwatch &amp; Countdown</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Keep time across pauses and refreshes, with no network connection.</p>
      </div>
      <Button class="h-11" variant="subtle" icon="lucide-star" :label="preferences.isFavourite('timer') ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite('timer')" />
    </header>

    <SegmentedTabs v-model="activeTab" :tabs="tabs" aria-label="Timekeeping tool" class="mt-8" />

    <div :id="`${activeTab}-panel`" class="pt-5" role="tabpanel" :aria-labelledby="`${activeTab}-tab`">
      <section v-if="activeTab === 'timer'" aria-labelledby="timer-heading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6">
          <h2 id="timer-heading" class="text-lg font-semibold text-ink-gray-9">Timer</h2>
          <div class="grid gap-4 pt-5 sm:grid-cols-2">
            <label class="grid gap-2 text-sm font-medium text-ink-gray-7">Minutes<input v-model="timerMinutes" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" type="number" min="1" max="1440" /></label>
            <label class="grid gap-2 text-sm font-medium text-ink-gray-7">Label (optional)<input v-model="timerLabel" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" maxlength="80" placeholder="Tea break" /></label>
          </div>
          <div class="flex flex-wrap gap-2 pt-6"><Button label="Set timer" icon-left="lucide-timer" variant="subtle" class="h-12" @click="setTimer" /><Button :label="timerAction" :icon-left="timerActionIcon" variant="solid" class="h-12" :disabled="!workspace.state.timer.durationMs" @click="workspace.toggleTimer" /><Button label="Reset" icon-left="lucide-rotate-ccw" variant="outline" class="h-12" @click="workspace.resetActiveTimer" /></div>
        </div>
        <TimeDisplay :label="workspace.state.timer.label || 'Timer remaining'" :milliseconds="workspace.state.timer.remainingMs" :status="workspace.state.timer.status" />
      </section>

      <section v-else-if="activeTab === 'stopwatch'" aria-labelledby="stopwatch-heading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
            <fieldset class="grid gap-3"><legend class="text-sm font-medium text-ink-gray-7">Countdown mode</legend><div class="flex gap-4"><label class="flex items-center gap-2"><input v-model="countdownMode" type="radio" value="duration" /> Duration</label><label class="flex items-center gap-2"><input v-model="countdownMode" type="radio" value="date" /> Date and time</label></div></fieldset>
            <label v-if="countdownMode === 'duration'" class="grid gap-2 text-sm font-medium text-ink-gray-7">Duration in minutes<input v-model="countdownMinutes" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" type="number" min="1" max="525600" /></label>
            <label v-else class="grid gap-2 text-sm font-medium text-ink-gray-7">Target date and time<input v-model="countdownDate" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-white px-3 text-base" type="datetime-local" /></label>
          </div>
          <p v-if="countdownError" class="pt-3 text-sm text-ink-red-3" role="alert">{{ countdownError }}</p>
          <div class="flex flex-wrap gap-2 pt-6"><Button label="Start countdown" icon-left="lucide-play" variant="solid" class="h-12" @click="startCountdown" /><Button label="Clear" icon-left="lucide-x" variant="outline" class="h-12" @click="workspace.clearCountdown" /></div>
          <p v-if="workspace.state.countdown.targetAt" class="pt-5 text-sm text-ink-gray-6">Target: <time>{{ targetText }}</time></p>
        </div>
        <TimeDisplay label="Countdown remaining" :milliseconds="workspace.state.countdown.remainingMs" :status="workspace.state.countdown.status" />
      </section>
    </div>

    <aside class="mt-8 flex gap-3 rounded-xl bg-surface-amber-1 px-4 py-3 text-sm leading-6 text-ink-gray-7"><Icon name="lucide-info" class="mt-1 size-4 shrink-0" /><p>Browsers and operating systems can suspend background tabs. Toolbox restores the correct time when you return, but it cannot guarantee that an alarm sounds while suspended.</p></aside>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import SegmentedTabs from '@/components/navigation/SegmentedTabs.vue'
import TimeDisplay from '@/tools/timer/TimeDisplay.vue'
import { useTimerWorkspace } from '@/tools/timer/useTimerWorkspace'
import { formatDuration } from '@/tools/timer/formatTime'

const tabs = [{ id: 'timer', label: 'Timer' }, { id: 'stopwatch', label: 'Stopwatch' }, { id: 'countdown', label: 'Countdown' }]
const activeTab = ref('timer'), timerMinutes = ref('5'), timerLabel = ref(''), countdownMode = ref('duration'), countdownMinutes = ref('60'), countdownDate = ref(''), countdownError = ref('')
const preferences = useToolboxPreferences(), workspace = useTimerWorkspace()
const stopwatchElapsed = workspace.stopwatchElapsed
const timerAction = computed(() => workspace.state.timer.status === 'running' ? 'Pause' : workspace.state.timer.status === 'paused' ? 'Resume' : 'Start')
const stopwatchAction = computed(() => workspace.state.stopwatch.status === 'running' ? 'Stop' : workspace.state.stopwatch.status === 'paused' ? 'Resume' : 'Start')
const timerActionIcon = computed(() => workspace.state.timer.status === 'running' ? 'lucide-pause' : 'lucide-play')
const stopwatchActionIcon = computed(() => workspace.state.stopwatch.status === 'running' ? 'lucide-square' : 'lucide-play')
const targetText = computed(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(workspace.state.countdown.targetAt))
function setTimer() { const minutes = Number(timerMinutes.value); if (minutes >= 1 && minutes <= 1440) workspace.configureTimer(minutes * 60000, timerLabel.value) }
function startCountdown() { countdownError.value = ''; const target = countdownMode.value === 'duration' ? Date.now() + Number(countdownMinutes.value) * 60000 : new Date(countdownDate.value).getTime(); if (!Number.isFinite(target) || target <= Date.now()) { countdownError.value = 'Choose a future date or a duration of at least one minute.'; return } workspace.setCountdown(target) }
onMounted(() => preferences.recordRecent('timer'))
</script>
