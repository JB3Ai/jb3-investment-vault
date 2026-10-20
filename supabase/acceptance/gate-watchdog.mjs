// Independent, bounded safety process. Receives only a deadline, never credentials.
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'
loadEnvFile('.env.local')
if (process.env.VITE_SUPABASE_URL !== 'https://uxeolplwhtyyefpmwktw.supabase.co') process.exit(1)
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
})
let cancelled = false
let armed = false
const startupTimer=setTimeout(()=>process.exit(1),90000)
async function closeAtDeadline() {
  if (cancelled) return
  let success = true
  for (const table of ['vault_settings', 'vault_content_settings']) {
    const result = await client.from(table).update({ access_enabled: false }).eq('id', 1).select('access_enabled')
    success &&= !result.error && result.data?.length === 1 && result.data[0].access_enabled === false
  }
  if (process.connected) process.send({ watchdogClosed: success })
  process.exit(success ? 0 : 1)
}
process.on('message', message => {
  if(message==='verified-closed'){cancelled=true;process.exit(0)}
  if(message?.arm && !armed){
    const delay=message.arm-Date.now()
    if(!Number.isSafeInteger(message.arm)||delay<=0||delay>60000)process.exit(1)
    armed=true;clearTimeout(startupTimer)
    setTimeout(closeAtDeadline,delay)
    if(process.connected)process.send({watchdogArmed:true})
  }
})
process.on('disconnect',()=>{if(!armed)process.exit(0)})
if(process.connected)process.send({watchdogReady:true})
