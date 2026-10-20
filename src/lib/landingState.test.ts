import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioSessionKey, bootCalibration, calibrationDuration, calibrationReturn, landingSessionKey, landingTiming, rememberFlag, sessionFlag, initialEntryPhase, matchesPresentationPin } from './landingState'
afterEach(() => vi.unstubAllGlobals())
describe('intro timing and optional presentation state', () => {
  it('requires the secure landing even when a previous intro flag is set', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'true' })
    expect(initialEntryPhase('secure')).toBe('landing')
    expect(initialEntryPhase('presentation')).toBe('landing')
    expect(initialEntryPhase('local')).toBe('ready')
    expect(initialEntryPhase('demo')).toBe('ready')
  })
  it('accepts the owner presentation cue without returning access credentials', () => {
    expect(matchesPresentationPin('2323')).toBe(true)
    for (const value of [2323, null, '1234', ' 2323', '2323 ', '232', '23233']) expect(matchesPresentationPin(value)).toBe(false)
  })
  it('uses the supplied device-specific reveal and boot timing', () => {
    expect(landingTiming(1440).reveals).toEqual([.5, 1.2, 1.9, 2.6])
    expect(landingTiming(768).init).toBe(3000)
    expect(landingTiming(375).skipPowerup).toBe(0)
  })
  it('keeps the triggered boot sequence within ten to twelve seconds', () => {
    for (const width of [375, 768, 1440]) {
      const timing = landingTiming(width)
      const total = (timing.init + timing.powerup) / 1000
      expect(total).toBeGreaterThanOrEqual(10)
      expect(total).toBeLessThanOrEqual(12)
    }
  })
  it('allows both three-second sweeps, the peak hold, stagger and a final settled frame', () => {
    expect(bootCalibration.travelDegrees * bootCalibration.peakFraction).toBe(216)
    expect(calibrationDuration).toBe(6500)
    expect(calibrationReturn).toBe(7100)
    expect(landingTiming(1440).powerup - calibrationReturn).toBe(700)
  })
  it('removes automatic animation delays for reduced motion', () => {
    const timing = landingTiming(1440, true)
    expect([...timing.reveals, timing.init, timing.powerup, timing.skipPowerup]).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
  it('handles unavailable storage without blocking access checks', () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw Error('unavailable') }, setItem() { throw Error('unavailable') } })
    expect(sessionFlag(landingSessionKey)).toBe(false)
    expect(() => rememberFlag(landingSessionKey, true)).not.toThrow()
  })
  it('stores only presentation preferences independently', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) })
    rememberFlag(landingSessionKey, true); rememberFlag(audioSessionKey, false)
    expect(sessionFlag(landingSessionKey)).toBe(true)
    expect(sessionFlag(audioSessionKey)).toBe(false)
    expect([...values.keys()]).toEqual([landingSessionKey, audioSessionKey])
  })
})
