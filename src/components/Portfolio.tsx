import {DocumentHoldCard} from './DocumentHoldCard'
import {PortfolioCarousel} from './PortfolioCarousel'
import {portfolioCollections,portfolioDocument,portfolioEntries,type PortfolioCollection,type PortfolioDocument} from '../lib/portfolio'
import type {BrochureEntry} from '../lib/brochures'
import '../styles/portfolio.css'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, FileText, LockKeyhole } from 'lucide-react'
import { brochureAssociation, brochureType, type BrochureDocument } from '../lib/brochures'
import { loadApprovedBrochures, downloadApprovedAsset, type ApprovedContent } from '../lib/privateContent'
import { thumbnailReference } from '../lib/thumbnailReference'
import { localReviewFetch, type LocalReview } from '../lib/localReview'
import { protectedDownload } from '../lib/protectedDownloads'
import { secureMode, supabase } from '../lib/supabase'
import { EvidencePreview } from './EvidencePreview'
import '../styles/evidence-review.css'
import '../styles/brochures.css'
const Viewer = lazy(() => import('./SecureDocumentViewer'))
type LocalDocuments = Pick<LocalReview, 'documents' | 'localDocumentPreviewIds' | 'thumbnailPreviews' | 'evidenceReviews' | 'documentNotices' | 'commercial'>

function ApprovedCover({ record, title }: { record?: ApprovedContent; title: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!record || !supabase) return
    const abort = new AbortController(); let source = ''; let timer: ReturnType<typeof setTimeout>
    void protectedDownload(supabase, 'assets', record.id, abort.signal).then(blob => {
      if (blob.type !== 'image/png' || abort.signal.aborted) return
      source = URL.createObjectURL(blob); setUrl(source)
      timer = setTimeout(() => { URL.revokeObjectURL(source); setUrl('') }, 55000)
    }).catch(() => { if (!abort.signal.aborted) setUrl('') })
    return () => { abort.abort(); clearTimeout(timer); if (source) URL.revokeObjectURL(source) }
  }, [record])
  return <figure className="evidence-preview">{url ? <img src={url} alt={'Private document cover: ' + title} /> : <div className="evidence-preview-placeholder"><FileText size={42} strokeWidth={1} /><span>Private cover unavailable</span></div>}<figcaption>Authorised private preview</figcaption></figure>
}
export function Portfolio({ onBack, local, recordId, presentationOnly = false }: { onBack: () => void; local?: LocalDocuments; recordId?: string; presentationOnly?: boolean }) {
  const [remote, setRemote] = useState<{ documents: ApprovedContent[]; thumbnails: ApprovedContent[] } | null>(null)
  const [loading, setLoading] = useState(!local && secureMode && !presentationOnly), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [opened, setOpened] = useState<{ data: Uint8Array; title: string } | null>(null), [busy, setBusy] = useState('')
  const [collection,setCollection]=useState<PortfolioCollection>('showcase'),[showcaseIndex,setShowcaseIndex]=useState(0)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => {
    if (presentationOnly || local || !secureMode || !supabase) return
    let cancelled = false; setLoading(true); setError(''); setRemote(null)
    void loadApprovedBrochures(supabase).then(result => { if (!cancelled) setRemote(result) }).catch(() => { if (!cancelled) setError('Private brochures are unavailable. Authentication, current grants and both release gates are required.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [local, revision, presentationOnly])
  const entries = useMemo(() => portfolioEntries((local?.documents ?? remote?.documents ?? []).map(record => portfolioDocument(record, local?.evidenceReviews?.find(review => review.recordId === record.id)?.metadata))), [local, remote])
  const showcase=entries.filter(entry=>entry.document.collection==='showcase'),clients=entries.filter(entry=>entry.document.collection==='client-engagements')
  const services=local?.commercial?.entries.filter(entry=>entry.category==='repeatable-service')??[]
  const clientHolds=local?.documentNotices?.filter(notice=>notice.collection==='client-engagements')??[]
  const featuredClients=[...clients.map(entry=>({order:entry.document.order,key:entry.document.id,entry})),...clientHolds.map((notice,index)=>({order:notice.association==='PTN Security'?3:4,key:notice.recordId??String(index),notice}))].sort((a,b)=>a.order-b.order)
  const target=entries.find(entry=>entry.versions.some(version=>version.id===recordId))
  useEffect(()=>{if(!target)return;setCollection(target.document.collection as PortfolioCollection);if(target.document.collection==='showcase')setShowcaseIndex(showcase.findIndex(entry=>entry.document.id===target.document.id))},[recordId,target?.document.id,target?.document.collection])
  useEffect(()=>{if(!recordId||!target||target.document.collection!==collection)return;const element=window.document.querySelector<HTMLElement>('[data-brochure-record="'+target.document.id+'"]');element?.scrollIntoView({block:'start',behavior:'instant'});element?.focus({preventScroll:true})},[recordId,collection,showcaseIndex,target])
  async function retrieve(document: BrochureDocument, download: boolean) {
    if (local && !local.localDocumentPreviewIds?.includes(document.id)) return
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller
    setBusy(document.id); setError('')
    try {
      const blob = local ? await (async () => {
        const response = await localReviewFetch('assets/' + document.id, controller.signal)
        if (!response.headers.get('cache-control')?.includes('no-store') || response.headers.get('content-type') !== 'application/pdf') throw Error()
        return response.blob()
      })() : supabase ? (await downloadApprovedAsset(supabase, document.id, controller.signal)).blob : null
      if (!blob || blob.type !== 'application/pdf' || controller.signal.aborted) throw Error()
      if (download) {
        const url = URL.createObjectURL(blob), anchor = window.document.createElement('a')
        anchor.href = url; anchor.download = document.originalFilename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        const data = new Uint8Array(await blob.arrayBuffer())
        if (!controller.signal.aborted) setOpened({ data, title: document.title })
      }
    } catch { if (!controller.signal.aborted) setError('Document access denied or unavailable. Your current permissions and source must be rechecked.') }
    finally { if (!controller.signal.aborted) setBusy('') }
  }
  function cover(document:PortfolioDocument){return local?<EvidencePreview thumbnail={local.thumbnailPreviews?.find(row=>row.parentId===document.id)} title={document.title}/>:<ApprovedCover record={remote?.thumbnails.find(row=>thumbnailReference(row.provenance.sourceReference)?.parentId===document.id)} title={document.title}/>}
  function card({document,versions}:BrochureEntry<PortfolioDocument>,withCover=true){const permitted=local?!!local.localDocumentPreviewIds?.includes(document.id):document.approval==='approved';return <article className="evidence-review-card portfolio-card" key={document.id} tabIndex={-1} data-brochure-record={document.id} data-portfolio-collection={document.collection} data-selected={versions.some(version=>version.id===recordId)||undefined}>
   {withCover&&cover(document)}<div className="portfolio-card-body"><span className="portfolio-association">{brochureAssociation(document)}</span><h3>{document.title}</h3><div className="portfolio-card-status"><span className="portfolio-status">{document.status}</span><span>{document.approval==='draft'?'Draft evidence':'Approved / classified'}</span></div><p className="portfolio-description">{document.description}</p>{document.ownershipNote&&<p className="portfolio-ownership">{document.ownershipNote}</p>}
   <dl className="portfolio-facts"><div><dt>Document date</dt><dd>{document.documentDate??'Not recorded'}</dd></div><div><dt>Version</dt><dd>{document.versionLabel??'Not recorded'}</dd></div></dl>
   {permitted?<div className="evidence-document-actions"><button className="document-row file-action" disabled={!!busy} onClick={()=>void retrieve(document,false)} aria-label={'View document: '+document.title}><FileText size={16}/>View PDF</button><button className="text-button file-action" disabled={!!busy} onClick={()=>void retrieve(document,true)} aria-label={'Download PDF: '+document.title}>Download PDF</button></div>:<p className="portfolio-withheld"><LockKeyhole size={14}/>Document permission required. Viewing and download access withheld.</p>}{busy===document.id&&<p role="status">Checking document access...</p>}
   <details><summary>Evidence &amp; version history ({versions.length})</summary><p>{document.statusBasis}</p><p>{brochureType(document)} / {document.classification} / {document.verification}</p><p>Proposal work is not contracted revenue. Third-party technology remains separate from JB³-owned IP.</p><ul>{versions.map(version=><li key={version.id}><strong>{version.originalFilename}</strong><p>{version.approval} / {version.verification}</p><p>{version.citation}</p><p>{version.sourceReference}</p></li>)}</ul></details></div></article>}
  function tabKey(event:React.KeyboardEvent<HTMLButtonElement>){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const value=event.key==='Home'?'showcase':event.key==='End'?'client-engagements':collection==='showcase'?'client-engagements':'showcase';setCollection(value);window.document.getElementById('portfolio-tab-'+value)?.focus()}
  return <main id="main-content" className="reader brochures-library portfolio-library"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/>Back to Console</button>{opened?<Suspense fallback={<p role="status">Opening protected PDF...</p>}><Viewer source={opened.data} title={opened.title} expiresAt={Date.now()+55000} onClose={()=>setOpened(null)} accessLabel="CONFIDENTIAL / BRUCE BLACKBURN / DRAFT EVIDENCE"/></Suspense>:<>
   <header className="reader-heading portfolio-heading"><span className="metadata">Confidential / Bruce Blackburn</span><h1>Portfolio</h1><p>Products, architecture and possibility.<br/>Client proposals and prototype work, with their evidence in view.</p></header>
   <div className="portfolio-tabs" role="tablist" aria-label="Portfolio collections">{portfolioCollections.map(value=><button key={value} role="tab" id={'portfolio-tab-'+value} aria-selected={collection===value} aria-controls={'portfolio-panel-'+value} tabIndex={collection===value?0:-1} onClick={()=>setCollection(value)} onKeyDown={tabKey}><span>{value==='showcase'?'JB\u00b3 Showcase':'Client Engagements'}<small>{value==='showcase'?showcase.length:featuredClients.length} document families</small></span><i aria-hidden="true"/></button>)}</div>
   <section className="portfolio-panel" id={'portfolio-panel-'+collection} role="tabpanel" aria-labelledby={'portfolio-tab-'+collection} tabIndex={0}><h2>{collection==='showcase'?'JB\u00b3 Showcase':'Client Engagements'}</h2><p className="portfolio-collection-note">{collection==='showcase'?'Product brochures, technical architecture and social-impact ideas.':'Client-specific concepts and proposals. Contract, payment and deployment status remain separate.'}</p>{error&&<div role="alert" className="form-error">{error}{!local&&<button className="text-button" onClick={()=>setRevision(value=>value+1)}>Retry portfolio</button>}</div>}{loading?<p role="status">Loading authorised documents...</p>:collection==='showcase'?showcase.length?<><PortfolioCarousel entries={showcase} index={Math.min(showcaseIndex,showcase.length-1)} onChange={setShowcaseIndex} cover={cover}/><div className="showcase-details">{card(showcase[Math.min(showcaseIndex,showcase.length-1)],false)}</div>{services.length>0&&<section className="portfolio-services" aria-label="Repeatable service offerings">{services.map(entry=><article className="evidence-review-card" key={entry.recordId}><span className="portfolio-association">JB³ Showcase / Service offering</span><h3>{entry.title}</h3><p className="portfolio-status">Repeatable commercial service offering / draft evidence</p><p>{entry.positioning}</p><ul className="module-note">{entry.limitations.map((limitation,index)=><li key={index}>{limitation}</li>)}</ul>{entry.sourceDocuments.length===0&&<p className="module-note">No supporting brochure is currently linked. Paying customers and contracted revenue are not inferred.</p>}</article>)}</section>}</>:<p className="brochure-empty">Document access pending.</p>:<div className="evidence-document-grid portfolio-grid">{featuredClients.map(item=>'entry' in item?card(item.entry):<DocumentHoldCard key={item.key} notice={item.notice} thumbnail={local?.thumbnailPreviews?.find(cover=>cover.parentId===item.notice.recordId)}/>)}{featuredClients.length===0&&<p className="brochure-empty">Document access pending.</p>}</div>}</section>
  </>}</main>
}
