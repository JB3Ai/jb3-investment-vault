// Node-only, read-only probes. Never import this module from the application.
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'

const expectedUrl = 'https://uxeolplwhtyyefpmwktw.supabase.co'
const checks = []
const record = (name, passed, details = {}) => checks.push({ name, passed, ...details })
const roleOf = key => {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role } catch { return null }
}
try {
  loadEnvFile('.env.local')
  const url = process.env.VITE_SUPABASE_URL
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  record('exact_project_url', url === expectedUrl)
  record('publishable_key_present_and_nonprivileged', !!publicKey && (publicKey.startsWith('sb_publishable_') || roleOf(publicKey) === 'anon'))
  record('server_only_admin_key_present', !!adminKey && (adminKey.startsWith('sb_secret_') || roleOf(adminKey) === 'service_role'))
  record('no_privileged_browser_env', !Object.entries(process.env).some(([name, value]) => /^(VITE_|NEXT_PUBLIC_)/.test(name) && value && (value.startsWith('sb_secret_') || value.startsWith('sbp_') || roleOf(value) === 'service_role')))
  if (checks.some(check => !check.passed)) throw new Error('local-prerequisite-failed')

  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) } }
  const admin = createClient(url, adminKey, options)
  const publicSettings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(30000) })
  record('publishable_key_accepted_by_target_auth', publicSettings.ok, { http_status: publicSettings.status })
  if (publicSettings.ok) {
    const settings = await publicSettings.json()
    record('password_email_provider_enabled', settings.external?.email === true)
  }

  // SDK supplies server-side authentication. Existing identities never leave memory.
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  record('auth_admin_read_via_supabase_sdk', !users.error, { http_status: users.error?.status ?? 200, error_code: /^[a-z_]+$/.test(users.error?.code ?? '') ? users.error.code : null })
  for (const bucket of ['vault-documents', 'vault-evidence']) {
    const result = await admin.storage.getBucket(bucket)
    record(`admin_${bucket}_private_bucket_read`, !result.error && result.data?.id === bucket && result.data.public === false, { http_status: Number(result.error?.statusCode) || (result.error ? null : 200) })
  }
} catch {
  record('prerequisite_process_completed', false)
}
const passed = checks.length > 0 && checks.every(check => check.passed)
console.log(JSON.stringify({ phase: 'read-only-credential-prerequisites', checkedAt: new Date().toISOString(), passed, checks }, null, 2))
process.exitCode = passed ? 0 : 1
