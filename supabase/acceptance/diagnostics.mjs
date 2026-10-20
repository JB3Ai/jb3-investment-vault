// Deliberately narrow diagnostic schema: no headers, URLs, IDs, bodies or tokens.
const numericKeys = new Set(['status','rows','bytes','clockSkewSeconds'])
const booleanKeys = new Set(['active','expired','bytesReturned','hashMatches','sessionPresent','tokenUnchanged','allowed','errorPresent','headersSafe','prewarmed'])
const dateKeys = new Set(['expiresAt','serverNow'])
const enumKeys = new Set(['errorCode','cacheStatus'])
const safeEnums = new Set(['none','unknown','42501','invalid_credentials','refresh_token_not_found','refresh_token_already_used','session_not_found','user_not_found','HIT','MISS','BYPASS','DYNAMIC','EXPIRED','REVALIDATED','STALE'])
export function safeObservation(input) {
  const out = {}
  for (const [key,value] of Object.entries(input ?? {})) {
    if (numericKeys.has(key) && (value === null || Number.isFinite(value))) out[key] = value
    if (booleanKeys.has(key) && typeof value === 'boolean') out[key] = value
    if (dateKeys.has(key) && (value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value))) out[key] = value
    if (enumKeys.has(key)) out[key] = safeEnums.has(value) ? value : 'unknown'
  }
  return out
}
export function assertionRecord(id, passed, expected, actual) {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,150}$/.test(id) || /sb_secret|sbp_|eyJ/.test(id)) throw new Error('unsafe-assertion-id')
  return { name:id, result:passed?'PASS':'FAIL', expected:safeObservation(expected), actual:safeObservation(actual), at:new Date().toISOString() }
}
