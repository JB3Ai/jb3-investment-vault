export const landingSessionKey = 'vaultLandingShown'
export const audioSessionKey = 'vaultAudioMuted'

export function sessionFlag(key: string): boolean {
  try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === 'true' } catch { return false }
}
export function rememberFlag(key: string, value: boolean) {
  try { sessionStorage.setItem(key, String(value)) } catch { /* Storage is optional presentation state, never authorisation. */ }
}
// Only the inert introduction shell uses this calibration timeline.
export const bootCalibration = {
  start: 300, stagger: 300, rise: 3000, hold: 500, fall: 3000,
  settle: 700, travelDegrees: 270, peakFraction: .8,
} as const
export const calibrationDuration = bootCalibration.rise + bootCalibration.hold + bootCalibration.fall
export const calibrationReturn = bootCalibration.start + bootCalibration.stagger + calibrationDuration
export function landingTiming(width: number, reducedMotion = false) {
  if (reducedMotion) return { reveals: [0, 0, 0, 0], reveal: 0, landing: 0, init: 0, powerup: 0, skipPowerup: 0 }
  const boot = { init: 3000, powerup: calibrationReturn + bootCalibration.settle, skipPowerup: 0 }
  if (width <= 480) return { reveals: [.3, .75, 1.2, 1.7], reveal: .6, landing: 2.8, ...boot }
  if (width <= 768) return { reveals: [.4, .95, 1.5, 2.1], reveal: .7, landing: 3, ...boot }
  return { reveals: [.5, 1.2, 1.9, 2.6], reveal: .8, landing: 3.5, ...boot }
}
