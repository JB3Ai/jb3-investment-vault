export const landingSessionKey = 'vaultLandingShown'
export const audioSessionKey = 'vaultAudioMuted'

export function sessionFlag(key: string): boolean {
  try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === 'true' } catch { return false }
}
export function rememberFlag(key: string, value: boolean) {
  try { sessionStorage.setItem(key, String(value)) } catch { /* Storage is optional presentation state, never authorisation. */ }
}
export function landingTiming(width: number, reducedMotion = false) {
  if (reducedMotion) return { reveals: [0, 0, 0, 0], reveal: 0, landing: 0, init: 0, powerup: 0, skipPowerup: 0 }
  if (width <= 480) return { reveals: [.3, .75, 1.2, 1.7], reveal: .6, landing: 2.8, init: 1400, powerup: 1800, skipPowerup: 0 }
  if (width <= 768) return { reveals: [.4, .95, 1.5, 2.1], reveal: .7, landing: 3, init: 1500, powerup: 2000, skipPowerup: 0 }
  return { reveals: [.5, 1.2, 1.9, 2.6], reveal: .8, landing: 3.5, init: 1600, powerup: 2200, skipPowerup: 0 }
}
