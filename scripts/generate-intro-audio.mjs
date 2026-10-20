// Original procedural sound design. No samples, recordings, music or third-party assets.
// Seeded synthesis makes the six committed PCM WAVs reproducible.
import { writeFileSync } from 'node:fs'

const rate = 48000, tau = Math.PI * 2
function noise(seed) {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1 }
}
function lowpass(cutoff) {
  const alpha = 1 - Math.exp(-tau * cutoff / rate)
  let previous = 0
  return value => previous += alpha * (value - previous)
}
const envelope = (t, duration, attack, release) => Math.sin(Math.min(1, t / attack) * Math.PI / 2) ** 2 * Math.sin(Math.min(1, (duration - t) / release) * Math.PI / 2) ** 2
function render(name, duration, sample) {
  const frames = Math.round(duration * rate), values = new Float64Array(frames)
  let peak = 0
  for (let i = 0; i < frames; i++) { values[i] = sample(i / rate) * envelope(i / rate, duration, .002, .025); peak = Math.max(peak, Math.abs(values[i])) }
  const wav = Buffer.alloc(44 + frames * 2)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40)
  // Source peaks at -6 dBFS; playback gain further attenuates every cue.
  for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(values[i] / peak * .5 * 32767), 44 + i * 2)
  wav.writeInt16LE(0, 44); wav.writeInt16LE(0, wav.length - 2)
  writeFileSync(new URL(`../src/assets/audio/${name}.wav`, import.meta.url), wav)
  console.log(`${name}: ${duration.toFixed(2)}s, 48 kHz mono PCM, source peak -6 dBFS`)
}

{
  const random = noise(3001), air = lowpass(150)
  render('ambient-pad', 4, t => envelope(t, 4, .45, .6) * (.18 * Math.sin(tau * 58 * t + .018 * Math.sin(tau * .3 * t)) + .05 * Math.sin(tau * 116 * t) + .65 * air(random())))
}
{
  const random = noise(3002), upper = lowpass(1900), lower = lowpass(180)
  render('shutter-whoosh', .24, t => {
    const n = random()
    return Math.sin(Math.PI * t / .24) ** 2 * (upper(n) - lower(n))
  })
}
{
  const random = noise(3003), felt = lowpass(1400)
  render('mechanism-click', .14, t => {
    const first = Math.exp(-t / .013), second = t > .045 ? .38 * Math.exp(-(t - .045) / .009) : 0
    return (first + second) * (.8 * felt(random()) + .18 * Math.sin(tau * 215 * t))
  })
}
{
  const random = noise(3004), friction = lowpass(720)
  render('whir-engage', .38, t => Math.sin(Math.PI * t / .38) ** 2 * (.32 * Math.sin(tau * (92 * t + 22 * t * t)) + .6 * friction(random())))
}
render('confirmation-chime', .52, t => (1 - Math.exp(-t / .012)) * Math.exp(-t / .14) * (.7 * Math.sin(tau * 520 * t) + .2 * Math.sin(tau * 913 * t) * Math.exp(-t / .1) + .08 * Math.sin(tau * 1471 * t) * Math.exp(-t / .07)))
{
  const random = noise(3006), floor = lowpass(110)
  render('power-hum', 2.5, t => envelope(t, 2.5, .2, .35) * (.4 * Math.sin(tau * 64 * t) + .08 * Math.sin(tau * 128 * t) + .35 * floor(random())))
}
