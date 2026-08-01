import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { createAlarmController } from './alarmController'
import { loadTimerWorkspace, saveTimerWorkspace } from './timerStorage'
import { STATUS, addLap, createCountdown, createStopwatch, createTimer, pauseStopwatch, pauseTimer, readCountdown, readStopwatch, readTimer, resetTimer, startStopwatch, startTimer } from './timeEngines'

export function useTimerWorkspace({ now = () => Date.now(), storage, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
  const saved = loadTimerWorkspace(storage)
  const state = reactive(saved ?? { timer: createTimer(300000), stopwatch: createStopwatch(), countdown: createCountdown() })
  const clock = ref(now())
  const alarm = createAlarmController()
  let timerWasDone = state.timer.status === STATUS.DONE
  const interval = setIntervalFn(tick, 250)

  function tick() {
    clock.value = now()
    const nextTimer = readTimer(state.timer, clock.value)
    const becameDone = nextTimer.status === STATUS.DONE && !timerWasDone
    Object.assign(state.timer, nextTimer)
    Object.assign(state.countdown, readCountdown(state.countdown, clock.value))
    timerWasDone = state.timer.status === STATUS.DONE
    if (becameDone) alarm.play()
  }

  function configureTimer(durationMs, label) {
    alarm.stop()
    Object.assign(state.timer, createTimer(durationMs, label.trim().slice(0, 80)))
    timerWasDone = false
    persist()
  }
  function toggleTimer() {
    alarm.stop()
    Object.assign(state.timer, state.timer.status === STATUS.RUNNING ? pauseTimer(state.timer, now()) : startTimer(state.timer, now()))
    timerWasDone = false
    persist()
  }
  function resetActiveTimer() { alarm.stop(); Object.assign(state.timer, resetTimer(state.timer)); timerWasDone = false; persist() }
  function toggleStopwatch() {
    Object.assign(state.stopwatch, state.stopwatch.status === STATUS.RUNNING ? pauseStopwatch(state.stopwatch, now()) : startStopwatch(state.stopwatch, now()))
    persist()
  }
  function lap() { Object.assign(state.stopwatch, addLap(state.stopwatch, now())); persist() }
  function resetStopwatch() { Object.assign(state.stopwatch, createStopwatch()); persist() }
  function setCountdown(targetAt) { Object.assign(state.countdown, createCountdown(targetAt)); tick() }
  function clearCountdown() { Object.assign(state.countdown, createCountdown()); persist() }
  function persist() { saveTimerWorkspace(state, storage) }

  const stopwatchElapsed = computed(() => readStopwatch(state.stopwatch, clock.value).elapsedMs)
  onBeforeUnmount(() => { clearIntervalFn(interval); alarm.stop() })
  tick()
  return { state, stopwatchElapsed, configureTimer, toggleTimer, resetActiveTimer, toggleStopwatch, lap, resetStopwatch, setCountdown, clearCountdown }
}
