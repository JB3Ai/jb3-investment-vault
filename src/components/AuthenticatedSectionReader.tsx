import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VaultSection } from '../types'
import type { ContentSectionId } from '../../content-migration/ingestion-schema'
import { loadApprovedNarratives, PrivateNarrativeError } from '../lib/privateContent'
import { SectionReader, type NarrativeReaderState } from './SectionReader'

export function AuthenticatedSectionReader({ client, accountId, section, onBack, onNext }: { client: SupabaseClient | null; accountId: string | undefined; section: VaultSection; onBack: () => void; onNext?: () => void }) {
  const [revision, setRevision] = useState(0)
  const identity = `${accountId}:${section.id}:${revision}`
  const [loaded, setLoaded] = useState<{ identity: string; state: NarrativeReaderState } | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!client || !accountId) { setLoaded({ identity, state: { status: 'access-denied', records: [], message: 'Authenticated access is required.' } }); return }
      try {
        const records = await loadApprovedNarratives(client, section.id as ContentSectionId)
        if (!cancelled) setLoaded({ identity, state: records.length ? { status: 'ready', records } : { status: 'unavailable', records: [], message: 'No approved narrative is available for this section. Owner review may still be pending.' } })
      } catch (error) {
        const denied = error instanceof PrivateNarrativeError && ['access-denied', 'release-disabled'].includes(error.code)
        if (!cancelled) setLoaded({ identity, state: { status: denied ? 'access-denied' : 'unavailable', records: [], message: error instanceof PrivateNarrativeError ? error.message : 'Approved narrative content could not be loaded. Try again.' } })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [client, accountId, section.id, identity])
  const state: NarrativeReaderState = loaded?.identity === identity ? loaded.state : { status: 'loading', records: [] }
  return <SectionReader section={{ ...section, narrative: [], evidence: [], verification: 'PENDING' }} onBack={onBack} onNext={onNext} narrativeState={state} onRetry={() => setRevision(value => value + 1)} />
}
