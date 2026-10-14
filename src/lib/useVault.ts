import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Disclosure, VaultSection } from '../types'
import { demoSections } from '../content/registry'
import { secureMode, supabase } from './supabase'

export function useVault() {
  const [session, setSession] = useState<Session | null>(null)
  const [sections, setSections] = useState<VaultSection[]>(secureMode ? [] : demoSections)
  const [tier, setTier] = useState<Disclosure | null>(null)
  const [loading, setLoading] = useState(secureMode && !!supabase)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setSections([]); setTier(null); setError(''); setLoading(!!next) })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !session) { setLoading(false); return }
    let cancelled = false
    const client = supabase
    async function load() {
      setLoading(true)
      try {
        const user = await client.auth.getUser()
        if (user.error || !user.data.user) throw new Error('Your session could not be verified. Sign in again.')
        const membership = await client.from('vault_memberships').select('access_level').eq('user_id', user.data.user.id).maybeSingle()
        if (membership.error) throw new Error('Access could not be checked. Try again.')
        if (!membership.data) throw new Error('This account has not been granted access to the vault.')
        const settings = await client.from('vault_settings').select('access_enabled').eq('id', 1).single()
        if (settings.error || !settings.data?.access_enabled) throw new Error('This vault is awaiting completion of its security verification.')
        const result = await client.from('vault_sections').select('*').order('number')
        if (result.error) throw new Error('The approved sections could not be loaded. Try again.')
        const loaded = (result.data ?? []).map(row => ({
          ...row, evidence: row.evidence ?? [], images: [], documents: [], narrative: row.narrative ?? [],
        })) as VaultSection[]
        if (!cancelled) { setSections(loaded); setTier(membership.data.access_level as Disclosure) }
      } catch (reason) { if (!cancelled) { setSections([]); setTier(null); setError(reason instanceof Error ? reason.message : 'Access unavailable.') } }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [session, revision])
  return { session, sections, tier, loading, error, retry: () => { setError(''); setRevision(n => n + 1) }, signOut: async () => { setSections([]); setTier(null); setSession(null); setError(''); await supabase?.auth.signOut({ scope: 'local' }) } }
}
