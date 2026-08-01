export function createAlarmController(createContext = () => new AudioContext()) {
  let context = null
  let oscillator = null

  function stop() {
    try { oscillator?.stop() } catch { /* The alarm may already have stopped. */ }
    oscillator = null
  }

  function play() {
    stop()
    try {
      context ??= createContext()
      oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.12, context.currentTime)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 1.5)
      oscillator.onended = () => { oscillator = null }
      return true
    } catch {
      stop()
      return false
    }
  }

  return { play, stop }
}
