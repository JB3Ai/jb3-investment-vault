import { createClient } from '@supabase/supabase-js'
export const secureMode = import.meta.env.VITE_VAULT_MODE === 'secure'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
// Only public/publishable keys belong in browser configuration. Never use service_role.
export const supabase = secureMode && url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } })
  : null
