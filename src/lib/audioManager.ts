import { audioSessionKey, rememberFlag, sessionFlag } from './landingState'

const audioUrls = {
  'ambient-pad': new URL('../assets/audio/ambient-pad.wav', import.meta.url).href,
  'shutter-whoosh': new URL('../assets/audio/shutter-whoosh.wav', import.meta.url).href,
  'mechanism-click': new URL('../assets/audio/mechanism-click.wav', import.meta.url).href,
  'whir-engage': new URL('../assets/audio/whir-engage.wav', import.meta.url).href,
  'confirmation-chime': new URL('../assets/audio/confirmation-chime.wav', import.meta.url).href,
  'power-hum': new URL('../assets/audio/power-hum.wav', import.meta.url).href,
} as const
export type AudioCue = keyof typeof audioUrls
export const dbToGain = (db: number) => Math.pow(10, Math.min(0, Math.max(-100, db)) / 20)

/** Original procedural instrument effects, created by scripts/generate-intro-audio.mjs. */
export class VaultAudioManager {
  private context: AudioContext | null = null
  private buffers = new Map<AudioCue, Promise<AudioBuffer | null>>()
  private sources = new Map<AudioBufferSourceNode, GainNode>()
  private generation = 0
  private muted = sessionFlag(audioSessionKey)

  isMuted() { return this.muted }
  setMuted(muted: boolean) {
    this.muted = muted
    rememberFlag(audioSessionKey, muted)
    if (muted) this.stopAll()
  }
  /** Called directly from a pointer or keyboard gesture; import creates no AudioContext. */
  async init() {
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Constructor) return false
        this.context = new Constructor()
      }
      if (this.context.state === 'suspended') await this.context.resume()
      if (this.context.state === 'running') for (const name of Object.keys(audioUrls) as AudioCue[]) void this.load(name)
      return this.context.state === 'running'
    } catch { return false }
  }
  private load(name: AudioCue) {
    if (!this.context) return Promise.resolve(null)
    if (!this.buffers.has(name)) {
      const context = this.context
      this.buffers.set(name, fetch(audioUrls[name]).then(async response => {
        if (!response.ok) return null
        return context.decodeAudioData(await response.arrayBuffer())
      }).catch(() => null))
    }
    return this.buffers.get(name)!
  }
  async playSound(name: AudioCue, delay = 0, db = -30, duration?: number) {
    if (this.muted || !this.context || this.context.state !== 'running') return
    const generation = this.generation, context = this.context
    const target = context.currentTime + Math.max(0, delay)
    const buffer = await this.load(name)
    if (!buffer || this.muted || generation !== this.generation || context.state !== 'running') return
    // Late loading never replays stale reveal cues over a later animation phase.
    if (delay > 0 && context.currentTime > target + .15) return
    const source = context.createBufferSource(), gain = context.createGain()
    const start = Math.max(target, context.currentTime), length = duration ?? buffer.duration
    source.buffer = buffer
    source.loop = duration !== undefined && duration > buffer.duration
    const fade = Math.min(.15, length / 3), level = dbToGain(db)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(level, start + fade)
    gain.gain.setValueAtTime(level, start + Math.max(fade, length - fade))
    gain.gain.linearRampToValueAtTime(0, start + length)
    source.connect(gain); gain.connect(context.destination)
    this.sources.set(source, gain)
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect() }
    source.start(start); source.stop(start + length)
  }
  stopAll() {
    this.generation++
    const now = this.context?.currentTime ?? 0
    for (const [source, gain] of this.sources) {
      try {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setTargetAtTime(0, now, .004)
        source.stop(now + .02)
      } catch { try { source.stop() } catch { /* Already ended. */ } }
    }
    this.sources.clear()
  }
}
export const audioManager = new VaultAudioManager()
