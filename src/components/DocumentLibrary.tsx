import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText, LockKeyhole, ArrowUpRight, Search } from 'lucide-react'
import { createDemoPdf } from '../lib/demoPdf'
import { secureMode, supabase } from '../lib/supabase'
import type { VaultDocument } from '../types'
const SecureDocumentViewer = lazy(() => import('./SecureDocumentViewer'))
interface OpenDocument { source: string | Uint8Array; title: string; expiresAt?: number }
export function DocumentLibrary({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<OpenDocument | null>(null)
  const [documents, setDocuments] = useState<VaultDocument[]>([])
  const [loading, setLoading] = useState(secureMode), [busyId, setBusyId] = useState('')
  const [error, setError] = useState(''), [query, setQuery] = useState(''), [revision, setRevision] = useState(0)
  const data = useMemo(() => createDemoPdf(), [])
  useEffect(() => {
    if (!secureMode || !supabase) return
    let cancelled = false
    setLoading(true); setError('')
    supabase.from('vault_documents').select('*').order('title').then(result => {
      if (cancelled) return
      if (result.error) setError('The document library could not be loaded.')
      else setDocuments(result.data as VaultDocument[])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [revision])
  async function openDocument(doc: VaultDocument) {
    if (!supabase || !doc.storage_path) return
    setBusyId(doc.id); setError('')
    try {
      // Supabase Storage enforces its SELECT RLS policy before issuing the URL.
      const { data: signed, error: signingError } = await supabase.storage.from('vault-documents').createSignedUrl(doc.storage_path, 60)
      if (signingError || !signed) throw new Error('Access unavailable')
      setOpen({ source: signed.signedUrl, title: doc.title, expiresAt: Date.now() + 55000 })
    } catch { setError('This document cannot be opened. Your access may have changed; retry or contact the vault owner.') }
    finally { setBusyId('') }
  }
  const visible = documents.filter(doc => doc.title.toLowerCase().includes(query.toLowerCase()))
  return <main id="main-content" className="reader"><button className="text-button" onClick={onBack}><ArrowLeft size={16} />Back to Console</button>
    {open ? <Suspense fallback={<p role="status" className="empty-state">Loading PDF reader…</p>}><SecureDocumentViewer source={open.source} title={open.title} expiresAt={open.expiresAt} onClose={() => setOpen(null)} /></Suspense> : <><header className="reader-heading library-heading"><h1>The document library.</h1><p>Evidence, with its source and status in view.</p></header>
    <p className="notice"><LockKeyhole size={18} />{secureMode ? 'Your account determines which documents are available. Viewing links expire after 60 seconds.' : 'Local demonstration. Confidential documents are unavailable.'}</p>
    {error && <div className="form-error" role="alert">{error}<button className="text-button" onClick={() => setRevision(n => n + 1)}>Retry library</button></div>}
    {secureMode ? <><label className="document-search"><Search size={16} /><input aria-label="Search documents" placeholder="Search available documents" value={query} onChange={e => setQuery(e.target.value)} /></label>{loading ? <p className="empty-state" role="status">Loading authorised documents…</p> : visible.length === 0 ? <p className="empty-state">No documents available{query ? ' matching your search' : ' for this account'}.</p> : visible.map(doc => <button className="document-row" key={doc.id} disabled={!!busyId} onClick={() => void openDocument(doc)}><FileText size={25} /><span><strong>{doc.title}</strong><small>{doc.disclosure} · {doc.verification} · {busyId === doc.id ? 'Checking access…' : 'PDF'}</small></span><ArrowUpRight size={18} /></button>)}</> :
    <><button className="document-row" onClick={() => setOpen({ source: data, title: 'Demonstration briefing' })}><FileText size={25} /><span><strong>Demonstration briefing</strong><small>PDF · Synthetic demonstration · Not verified</small></span><ArrowUpRight size={18} /></button><p className="module-note">This sample is generated locally. No private file is served from the public assets folder.</p></>}</>}
  </main>
}
