import {presentationView} from '../lib/presentationCopy'
import {portfolioDocument} from '../lib/portfolio'
import {brochureEntries,brochureDocument} from '../lib/brochures'
import { Portfolio } from './Portfolio'
import { CommercialRegister } from './CommercialRegister'
import { AssetsRegister } from './AssetsRegister'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ArrowLeft, FileText, ArrowUpRight } from 'lucide-react'
import { LeatherBackground } from './LeatherBackground'
import { ConsoleFrame } from './ConsoleFrame'
import { SectionReader } from './SectionReader'
import { EvidenceGallery } from './EvidenceGallery'
import { ExecutiveBriefing } from './ExecutiveBriefing'
import { NarrativeText } from './NarrativeText'
import { FinancialWorkspace } from './FinancialWorkspace'
import { HiFiNavigation } from './HiFiNavigation'
import { OriginalVideoEvidence } from './OriginalVideoEvidence'
import { OfficeOptions } from './OfficeOptions'
import { EvidenceReviewCard } from './EvidenceReviewCard'
import { EvidencePreview } from './EvidencePreview'
import { emptySustainable } from '../lib/financialScenarios'
import { demoSections } from '../content/registry'
import { localReviewFetch, type LocalReview } from '../lib/localReview'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
import type { VaultSection, VaultImage } from '../types'

const Viewer = lazy(() => import('./SecureDocumentViewer'))
type View = 'console' | 'reader' | 'documents' | 'finances' | 'briefing' | 'portfolio'
function LaboratoryReview({ laboratory }: { laboratory: LocalReview['laboratory'] }) {
  const [images, setImages] = useState<VaultImage[]>([])
  const [textSize,setTextSize]=useState(()=>{try { const value=localStorage.getItem('jb3-lab-text-size');return ['small','standard','large'].includes(value??'')?value!:'standard' } catch {return 'standard'}})
  const [error, setError] = useState(false)
  useEffect(() => {
    const abort = new AbortController(), urls: string[] = []
    void Promise.all(laboratory.photographs.map(async record => {
      const response = await localReviewFetch(`assets/${record.id}`, abort.signal)
      const blob = await response.blob()
      abort.signal.throwIfAborted()
      const url = URL.createObjectURL(blob); urls.push(url)
      return { id: record.id, caption: String(record.payload.caption), alt: String(record.payload.alt), url, originalFilename:record.provenance.originalFilename,sha256:record.file?.sha256 }
    })).then(images => { if (!abort.signal.aborted) setImages(images) }).catch(() => { if (!abort.signal.aborted) setError(true) })
    return () => { abort.abort(); urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [laboratory])
  return <section className="content-module laboratory-review" data-text-size={textSize} aria-label="23-day laboratory interlude"><div className="lab-text-control"><label>Text size<select aria-label="Laboratory text size" value={textSize} onChange={e=>{setTextSize(e.target.value);try{localStorage.setItem('jb3-lab-text-size',e.target.value)}catch{}}}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></label></div><div className="module-heading"><h2>{laboratory.title}</h2><span className="metadata">BRUCE_PRIVATE / DRAFT / DRAFT EVIDENCE</span></div>{laboratory.records.map(record => <NarrativeText key={record.id} body={String(record.payload.body)} />)}<p className="module-note">Separate interlude between Sections 03 and 04. Founder-provided display sequencing is distinct from independently verified chronology. Historical chronology and certification remain unverified; no date is inferred from filenames.</p>{error ? <p role="alert">Laboratory photographs could not be loaded. Source verification is required.</p> : images.length ? <EvidenceGallery images={images} review displayReview={laboratory.review} /> : <p role="status">Loading private laboratory photographs…</p>}{laboratory.review && <OriginalVideoEvidence videos={laboratory.review.videos} />}</section>
}

function PrivateDocuments({ documents, reviews = [], allowed = [], thumbnails = [], fullLibrary=false }: { fullLibrary?:boolean; documents: ContentRecord[]; reviews?: LocalReview['evidenceReviews']; allowed?: string[]; thumbnails?:LocalReview['thumbnailPreviews'] }) {
  if(fullLibrary)documents=documents.filter(record=>record.classification==='LEGAL_RESTRICTED'||portfolioDocument(record,reviews.find(review=>review.recordId===record.id)?.metadata).collection==='evidence-only')
  documents=[...documents.filter(record=>record.classification==='LEGAL_RESTRICTED'),...brochureEntries(documents.filter(record=>record.classification!=='LEGAL_RESTRICTED').map(record=>brochureDocument(record,reviews.find(review=>review.recordId===record.id)?.metadata))).map(entry=>documents.find(record=>record.id===entry.document.id)!)]
  const [opened,setOpened]=useState<{data:Uint8Array;title:string}|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function retrieve(record:ContentRecord,download=false){
    if(!allowed.includes(record.id))return
    setBusy(true);setError('')
    try{const response=await localReviewFetch(`assets/${record.id}`);const blob=await response.blob();if(download){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=record.provenance.originalFilename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}else setOpened({data:new Uint8Array(await blob.arrayBuffer()),title:String(record.payload.title)})}
    catch{setError('The private PDF is unavailable. Check source validation and access.')}
    finally{setBusy(false)}
  }
  if(opened)return <Suspense fallback={<p role="status">Opening private PDF...</p>}><Viewer source={opened.data} title={opened.title} onClose={()=>setOpened(null)} accessLabel="BRUCE_PRIVATE / DRAFT EVIDENCE / CONFIDENTIAL"/></Suspense>
  return <section className="content-module evidence-library" aria-label="Supporting evidence library"><div className="module-heading"><h2>Documents &amp; Evidence</h2><span className="metadata">PRIVATE / OWNER REVIEW</span></div><p className="module-note">Supporting records retain their classification, verification and access permissions. Draft evidence remains subject to review.</p>{error&&<p role="alert">{error}</p>}{[['Corporate / Investment Presentations',documents.filter(r=>r.classification!=='LEGAL_RESTRICTED'&&/investor|investment deck/i.test(String(r.payload.title)+' '+r.provenance.originalFilename))],['Supporting evidence',documents.filter(r=>r.classification!=='LEGAL_RESTRICTED'&&!/investor|investment deck/i.test(String(r.payload.title)+' '+r.provenance.originalFilename))],['Restricted legal dossiers',documents.filter(r=>r.classification==='LEGAL_RESTRICTED')]].map(([label,items])=>{const rows=items as ContentRecord[];return rows.length?<section className="evidence-library-group" key={String(label)} aria-label={String(label)}><h3>{String(label)}</h3>{String(label)==='Restricted legal dossiers'&&<p className="module-note">Separate LEGAL_RESTRICTED permission required. No access is inferred from Bruce&apos;s private investor classification.</p>}<div className="evidence-document-grid">{rows.map(record=>{const review=reviews.find(r=>r.recordId===record.id),thumbnail=thumbnails.find(item=>item.parentId===record.id),preview=<EvidencePreview thumbnail={thumbnail} title={String(record.payload.title)}/>;return review?<EvidenceReviewCard key={record.id} record={record} review={review} preview={preview} actions={allowed.includes(record.id)?<div className="evidence-document-actions"><button className="document-row" disabled={busy} onClick={()=>void retrieve(record)} aria-label={`Open document: ${record.payload.title}`}><FileText size={18}/>Open Document</button><button className="text-button" disabled={busy} onClick={()=>void retrieve(record,true)} aria-label={`Download document: ${record.payload.title}`}>Download PDF</button></div>:undefined}/>:<article className="evidence-review-card" data-document-record={record.id} key={record.id}><div className="module-heading"><h3>{record.payload.title}</h3><span className="metadata">{record.classification}</span></div><p className="evidence-review-status">{record.approval} / CONFIDENTIAL / BRUCE BLACKBURN</p>{preview}<p className="evidence-card-category">Founder history &amp; supporting evidence</p><p className="module-note">{record.verification} / Private draft evidence; publication remains pending.</p>{allowed.includes(record.id)?<div className="evidence-document-actions"><button className="document-row" disabled={busy} aria-label={`Open document: ${record.payload.title}`} onClick={()=>void retrieve(record)}><FileText size={18}/>Open Document<ArrowUpRight size={16}/></button><button className="text-button" disabled={busy} aria-label={`Download document: ${record.payload.title}`} onClick={()=>void retrieve(record,true)}>Download PDF</button></div>:<p className="module-note">Viewing and download access withheld.</p>}<details><summary>Source &amp; verification notes</summary><p>{record.provenance.originalFilename}</p><p>{record.provenance.citation}</p><p>{record.provenance.sourceReference}</p></details></article>})}</div></section>:null})}</section>
}

export default function PrivateLocalVault({ onReplay }: { onReplay: () => void }) {
  const [data, setData] = useState<LocalReview | null>(null), [error, setError] = useState('')
  const [view, setView] = useState<View>('console'), [selected, setSelected] = useState('introduction')
  const [schedule, setSchedule] = useState<'personal' | 'business'>('personal')
  const [rate, setRate] = useState('')
  const [scenario,setScenario] = useState(emptySustainable)
  const [retry, setRetry] = useState(0)
  const [brochureRecord,setBrochureRecord]=useState<string|undefined>()
  const openBrochure=(id:string)=>{setBrochureRecord(id);navigate('portfolio')}
  useEffect(() => {
    const abort = new AbortController()
    void localReviewFetch('content', abort.signal).then(response => response.json()).then(content => { if (!abort.signal.aborted) { setData(presentationView(content)); setRate(current => current || String(content.finances.exchangeRate?.zarPerGbp ?? '')) } }).catch(() => { if (!abort.signal.aborted) setError('Private local content is unavailable. Check the external intake and restart the preview if a source changed.') })
    return () => abort.abort()
  }, [retry])
  const sections = useMemo<VaultSection[]>(() => data ? data.sections.map(({ id, narrative }) => ({ ...demoSections.find(section => section.id === id)!, subtitle: narrative.payload.heading.replace(/^\d+\s*\|\s*/, ''), overview: '', narrative: [narrative.payload], evidence: [], images: [], documents: [], disclosure: 'PRIVATE', verification: 'PENDING', updated_at: narrative.provenance.reviewedOn! })) : [], [data])
  const section = sections.find(section => section.id === selected)
  const next = sections[sections.findIndex(section => section.id === selected) + 1]
  const navigate = (view: View) => { setView(view); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const open = (id: string) => { setSelected(id); navigate('reader') }
  useEffect(() => { document.title = 'JB³ Private Investment Vault: Confidential / Bruce Blackburn' }, [])
  useEffect(() => { if (view === 'reader') document.querySelector<HTMLElement>('.reader h1')?.focus() }, [view, selected])
  return <MotionConfig reducedMotion="user"><LeatherBackground><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell"><header className="site-header"><button className="brand" aria-label="JB³ vault home" onClick={() => navigate('console')}>JB<sup>3</sup></button><span className="brand-divider" /><span className="brand-title">PRIVATE INVESTMENT VAULT</span><span className="edition"><span className="status-light" />Confidential / Bruce Blackburn</span></header>{data && <HiFiNavigation active={view} onDocuments={() => navigate('documents')} onFinances={() => navigate('finances')} onBriefing={() => navigate('briefing')} onPortfolio={() => {setBrochureRecord(undefined);navigate('portfolio')}} />}
    {error ? <main id="main-content" className="entry"><h1>Private content unavailable.</h1><p role="alert">{error}</p><button className="primary-button" onClick={() => { setError(''); setRetry(value => value + 1) }}>Retry local content</button></main> : !data || !section ? <main id="main-content" className="entry"><p role="status">Loading private owner review…</p></main> : view === 'console' ? <ConsoleFrame sections={sections} selected={section} onSelect={setSelected} onOpen={open} /> : view === 'reader' ? <SectionReader section={section} navigation={{ sections: sections, onNavigate: open }} onBack={() => navigate('console')} onNext={next ? () => open(next.id) : undefined} richNarrative narrativeState={{ status: 'ready', records: [data.sections.find(item => item.id === selected)!.narrative] }}>
      {selected==='commercial-pipeline'&&data.commercial&&<CommercialRegister review={data.commercial} documents={data.documents} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} onDocument={openBrochure}/>}
      {selected==='assets-claims'&&data.assets&&<AssetsRegister review={data.assets} documents={data.documents} rate={rate}/>}
      {['current-position','history-evidence','assets-claims'].includes(selected) && <PrivateDocuments documents={data.documents.filter(record=>data.evidenceReviews?.find(item=>item.recordId===record.id)?.sectionIds.includes(selected)??selected==='history-evidence')} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} thumbnails={data.thumbnailPreviews}/>}
      {selected === 'history-evidence' && <LaboratoryReview laboratory={data.laboratory} />}
      {selected === 'southern-african-strategy' && <OfficeOptions />}
      {['financial-requirements', 'financial-forecast'].includes(selected) && <section className="content-module"><h2>Personal and business financial schedules</h2><p className="module-note">Working estimates remain draft pending reconciliation and owner approval.</p><div className="structure-tabs">{(['personal', 'business'] as const).map(name => <button key={name} onClick={() => { setSchedule(name); navigate('finances') }}>Open {name} schedule</button>)}</div></section>}
    </SectionReader> : view === 'portfolio' ? <Portfolio recordId={brochureRecord} local={data} onBack={() => navigate('console')} /> : view === 'briefing' ? <ExecutiveBriefing sections={sections} onBack={() => navigate('console')} privateExport={{rate,scenario}} /> : <main id="main-content" className="reader"><div className="reader-toolbar"><button className="text-button" onClick={() => navigate('console')}><ArrowLeft size={16} />Back to Console</button><span className="mono">CONFIDENTIAL / BRUCE BLACKBURN</span></div>{view === 'documents' ? <PrivateDocuments fullLibrary documents={data.documents} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} thumbnails={data.thumbnailPreviews} /> : <FinancialWorkspace data={data.finances} schedule={schedule} onSchedule={setSchedule} rate={rate} onRate={setRate} scenario={scenario} onScenario={setScenario} />}</main>}
    <footer className="site-footer"><span className="footer-brand">JB<sup>3</sup></span><span>/ Jonathan Blackburn</span><span className="footer-rule" /><span>Private by intention.</span><button className="footer-exit" onClick={onReplay} aria-label="Replay introduction" title="Replay introduction"><ArrowLeft size={16} /></button></footer></div></LeatherBackground></MotionConfig>
}
