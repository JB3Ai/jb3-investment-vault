import {SectionVisual} from './SectionVisual'
import {ReadingRoom} from './ReadingRoom'
import {BuildReference} from './BuildReference'
import {narrativeReferences,type NarrativeReference} from '../lib/narrativeReferences'
import {ContextualDocumentReference} from './ContextualDocumentReference'
import {ContextualPdfDialog} from './ContextualPdfDialog'
import {emptyCashFlow} from '../lib/cashFlow'
import {evidenceGroups} from '../lib/evidenceLibrary'
import {DocumentHoldCard} from './DocumentHoldCard'
import {ChapterNavigation} from './ChapterNavigation'
import {presentationView} from '../lib/presentationCopy'
import {portfolioDocument} from '../lib/portfolio'
import {brochureEntries,brochureDocument} from '../lib/brochures'
import { Portfolio } from './Portfolio'
import { CommercialRegister } from './CommercialRegister'
import { AssetsRegister } from './AssetsRegister'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { localReviewFetch, type LocalReview, type DocumentNotice } from '../lib/localReview'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
import type { VaultSection, VaultImage } from '../types'

const Viewer = lazy(() => import('./SecureDocumentViewer'))
type View = 'console' | 'reader' | 'documents' | 'finances' | 'briefing' | 'portfolio' | 'laboratory' | 'reading-room'
function LaboratoryReview({laboratory}:{laboratory:LocalReview['laboratory']}){
 const [images,setImages]=useState<VaultImage[]>([]),[missing,setMissing]=useState<string[]>([]),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0)
 const [textSize,setTextSize]=useState(()=>{try{const value=localStorage.getItem('jb3-lab-text-size');return ['small','standard','large'].includes(value??'')?value!:'standard'}catch{return 'standard'}})
 useEffect(()=>{
  const abort=new AbortController(),urls:string[]=[];setLoading(true);setMissing([]);setImages([])
  void Promise.allSettled(laboratory.photographs.map(async record=>{
   const response=await localReviewFetch('assets/'+record.id,AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]))
   if(!response.headers.get('content-type')?.startsWith('image/')||!response.headers.get('cache-control')?.includes('no-store'))throw Error('Private photograph unavailable')
   const blob=await response.blob();abort.signal.throwIfAborted();const url=URL.createObjectURL(blob);urls.push(url)
   return {id:record.id,caption:String(record.payload.caption),alt:String(record.payload.alt),url,originalFilename:record.provenance.originalFilename,sha256:record.file?.sha256}
  })).then(results=>{if(abort.signal.aborted)return;setImages(results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]));setMissing(results.flatMap((result,index)=>result.status==='rejected'?[laboratory.photographs[index].provenance.originalFilename+' / '+laboratory.photographs[index].id]:[]));setLoading(false)})
  return()=>{abort.abort();urls.forEach(url=>URL.revokeObjectURL(url))}
 },[laboratory,attempt])
 return <section className="content-module laboratory-review" data-text-size={textSize} aria-label="23-day laboratory interlude"><div className="lab-text-control"><label>Text size<select aria-label="Laboratory text size" value={textSize} onChange={event=>{setTextSize(event.target.value);try{localStorage.setItem('jb3-lab-text-size',event.target.value)}catch{}}}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></label></div><div className="module-heading"><h2>{laboratory.title}</h2><span className="metadata">BRUCE_PRIVATE / DRAFT / DRAFT EVIDENCE</span></div>{laboratory.records.map(record=><NarrativeText key={record.id} body={String(record.payload.body)}/>)}<p className="module-note">Separate interlude between Sections 03 and 04. Founder-provided display sequencing is distinct from independently verified chronology. Historical chronology and certification remain unverified; no date is inferred from filenames.</p>
 {loading?<p role="status">Loading private laboratory photographs...</p>:<>{(!laboratory.photographs.length||missing.length>0||laboratory.photographs.length!==12)&&<div role="alert" className="gallery-load-diagnostic"><p>Owner review: expected twelve registered original photographs; found {laboratory.photographs.length} mappings and loaded {images.length}. Check the private intake or file gateway.</p>{missing.length>0&&<ul>{missing.map(item=><li key={item}>{item}</li>)}</ul>}<button className="text-button" onClick={()=>setAttempt(value=>value+1)}>Retry photographs</button></div>}{images.length>0&&<EvidenceGallery images={images} review displayReview={laboratory.review}/>}</>}{laboratory.review&&<OriginalVideoEvidence videos={laboratory.review.videos}/>}</section>
}

function PrivateDocuments({ documents, reviews = [], allowed = [], thumbnails = [], fullLibrary=false, notices=[], targetId }: { targetId?:string; notices?:DocumentNotice[]; fullLibrary?:boolean; documents: ContentRecord[]; reviews?: LocalReview['evidenceReviews']; allowed?: string[]; thumbnails?:LocalReview['thumbnailPreviews'] }) {
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
  useEffect(()=>{if(opened||!targetId||!/^[a-f0-9-]{36}$/.test(targetId))return;const card=document.querySelector<HTMLElement>('[data-evidence-record="'+targetId+'"]');card?.scrollIntoView({block:'start',behavior:'instant'});card?.focus({preventScroll:true})},[targetId,opened])
  if(opened)return <Suspense fallback={<p role="status">Opening private PDF...</p>}><Viewer source={opened.data} title={opened.title} onClose={()=>setOpened(null)} accessLabel="BRUCE_PRIVATE / DRAFT EVIDENCE / CONFIDENTIAL"/></Suspense>
  return <section className="content-module evidence-library" aria-label="Supporting evidence library"><div className="module-heading"><h2>Documents &amp; Evidence</h2><span className="metadata">PRIVATE / OWNER REVIEW</span></div><p className="module-note">Supporting records retain their classification, verification and access permissions. Draft evidence remains subject to review.</p>{error&&<p role="alert">{error}</p>}{evidenceGroups(notices.some(n=>n.collection==='legal')?documents.filter(r=>r.classification!=='LEGAL_RESTRICTED'):documents,reviews).map(([label,items])=>{const rows=items as ContentRecord[];return rows.length?<section className="evidence-library-group" key={String(label)} aria-label={String(label)}><h3>{String(label)}</h3>{String(label)==='Legal & supporting records'&&<p className="module-note">Separate LEGAL_RESTRICTED permission required. No access is inferred from Bruce&apos;s private investor classification.</p>}<div className="evidence-document-grid">{rows.map(record=>{const review=reviews.find(r=>r.recordId===record.id),thumbnail=thumbnails.find(item=>item.parentId===record.id),preview=<EvidencePreview thumbnail={thumbnail} title={String(record.payload.title)}/>;return review?<EvidenceReviewCard key={record.id} record={record} review={review} preview={preview} actions={allowed.includes(record.id)?<div className="evidence-document-actions"><button className="document-row file-action" disabled={busy} onClick={()=>void retrieve(record)} aria-label={`Open document: ${record.payload.title}`}><FileText size={18}/>Open Document</button><button className="text-button file-action" disabled={busy} onClick={()=>void retrieve(record,true)} aria-label={`Download document: ${record.payload.title}`}>Download PDF</button></div>:undefined}/>:<article className="evidence-review-card" data-document-record={record.id} key={record.id}><div className="module-heading"><h3>{record.payload.title}</h3><span className="metadata">{record.classification}</span></div><p className="evidence-review-status">{record.approval} / CONFIDENTIAL / BRUCE BLACKBURN</p>{preview}<p className="evidence-card-category">Founder history &amp; supporting evidence</p><p className="module-note">{record.verification} / Private draft evidence; publication remains pending.</p>{allowed.includes(record.id)?<div className="evidence-document-actions"><button className="document-row file-action" disabled={busy} aria-label={`Open document: ${record.payload.title}`} onClick={()=>void retrieve(record)}><FileText size={18}/>Open Document<ArrowUpRight size={16}/></button><button className="text-button file-action" disabled={busy} aria-label={`Download document: ${record.payload.title}`} onClick={()=>void retrieve(record,true)}>Download PDF</button></div>:<p className="module-note">Viewing and download access withheld.</p>}<details><summary>Source &amp; verification notes</summary><p>{record.provenance.originalFilename}</p><p>{record.provenance.citation}</p><p>{record.provenance.sourceReference}</p></details></article>})}</div></section>:null})}{fullLibrary&&[...new Set(notices.filter(n=>n.collection==='evidence').map(n=>n.category??'Supporting evidence'))].map(category=><section className="evidence-library-group" key={category} aria-label={category}><h3>{category}</h3><div className="evidence-document-grid">{notices.filter(n=>n.collection==='evidence'&&(n.category??'Supporting evidence')===category).map(n=><DocumentHoldCard key={n.recordId??n.title} notice={n} thumbnail={thumbnails.find(item=>item.parentId===n.recordId)}/>)}</div></section>)}{fullLibrary&&notices.some(n=>n.collection==='legal')&&<section className="evidence-library-group" aria-label="Legal & supporting records"><h3>LEGAL &amp; SUPPORTING RECORDS</h3><p className="module-note">Restricted originals remain unpublished. Catalogue entries identify source associations only; the presentation PIN grants no access.</p><div className="evidence-document-grid">{notices.filter(n=>n.collection==='legal').map(n=><DocumentHoldCard key={n.title} notice={n} thumbnail={thumbnails.find(item=>item.parentId===n.recordId)}/>)}</div></section>}</section>
}

export default function PrivateLocalVault({ onReplay }: { onReplay: () => void }) {
  const [data, setData] = useState<LocalReview | null>(null), [error, setError] = useState('')
  const readLocation=()=>{let hash='';try{hash=decodeURIComponent(window.location.hash.slice(1))}catch{};const chapter=hash.match(/^chapter\/([a-z-]+)$/)?.[1];return chapter&&demoSections.some(s=>s.id===chapter)?{view:'reader' as View,selected:chapter}:hash==='laboratory'?{view:'laboratory' as View,selected:'history-evidence'}:{view:((['documents','finances','briefing','portfolio','reading-room'] as string[]).includes(hash)?hash:'console') as View,selected:'introduction'}}
  const [view, setView] = useState<View>(()=>readLocation().view), [selected, setSelected] = useState(()=>readLocation().selected)
  const [contextPdf,setContextPdf]=useState<{data:Uint8Array;title:string}|null>(null),[contextBusy,setContextBusy]=useState(false),[contextError,setContextError]=useState('')
  const contextRequest=useRef<AbortController|null>(null),contextFocus=useRef<HTMLElement|null>(null)
  useEffect(()=>()=>contextRequest.current?.abort(),[])
  useEffect(()=>{contextRequest.current?.abort();setContextPdf(null);setContextBusy(false);setContextError('')},[view,selected])
  const lastRead=useRef(readLocation().view==='laboratory'?'laboratory':readLocation().selected)
  useEffect(()=>{if(view==='reader')lastRead.current=selected;else if(view==='laboratory')lastRead.current='laboratory'},[view,selected])
  const [schedule, setSchedule] = useState<'personal' | 'business'>('personal')
  const [rate, setRate] = useState('')
  const [scenario,setScenario] = useState(emptySustainable)
  const [cashFlow,setCashFlow]=useState(emptyCashFlow)
  const [retry, setRetry] = useState(0)
  const [evidenceRecord,setEvidenceRecord]=useState<string|undefined>()
  const openEvidence=(id:string)=>{setEvidenceRecord(id);navigate('documents')}
  const [brochureRecord,setBrochureRecord]=useState<string|undefined>()
  const openBrochure=(id:string)=>{setBrochureRecord(id);navigate('portfolio')}
  useEffect(() => {
    const abort = new AbortController()
    void localReviewFetch('content', abort.signal).then(response => response.json()).then(content => { if (!abort.signal.aborted) { setData(presentationView(content)); setRate(current => current || String(content.finances.exchangeRate?.zarPerGbp ?? '')) } }).catch(() => { if (!abort.signal.aborted) setError('The presentation could not be loaded. Please retry.') })
    return () => abort.abort()
  }, [retry])
  const sections = useMemo<VaultSection[]>(() => data ? data.sections.map(({ id, narrative }) => ({ ...demoSections.find(section => section.id === id)!, subtitle: narrative.payload.heading.replace(/^\d+\s*\|\s*/, ''), overview: '', narrative: [narrative.payload], evidence: [], images: [], documents: [], disclosure: 'PRIVATE', verification: 'PENDING', updated_at: narrative.provenance.reviewedOn! })) : [], [data])
  const section = sections.find(section => section.id === selected)
  const next = sections[sections.findIndex(section => section.id === selected) + 1]
  const navigate = (view: View, id=selected) => { setView(view); const hash=view==='reader'?'chapter/'+id:view==='laboratory'?'laboratory':view==='console'?'':view;window.history.pushState(null,'',window.location.pathname+window.location.search+(hash?'#'+hash:''));window.scrollTo({ top: 0, behavior: 'instant' }) }
  const open = (id: string) => { setSelected(id); navigate('reader',id) }
  const openLaboratory=()=>navigate('laboratory')
  const references=data&&section?narrativeReferences(data,selected,section.narrative[0].body):[]
  async function retrieveContext(reference:NarrativeReference,download=false,trigger?:HTMLElement){
   const record=data?.documents.find(item=>item.id===reference.id)
   if(!reference.available||!record||record.classification==='LEGAL_RESTRICTED'||!data?.localDocumentPreviewIds?.includes(record.id))return
   if(!download)contextFocus.current=trigger??document.activeElement as HTMLElement;
   contextRequest.current?.abort();const controller=new AbortController();contextRequest.current=controller;setContextBusy(true);setContextError('')
   try{const response=await localReviewFetch('assets/'+record.id,controller.signal);if(response.headers.get('content-type')!=='application/pdf'||!response.headers.get('cache-control')?.includes('no-store'))throw Error();const blob=await response.blob();if(controller.signal.aborted)return;if(download){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=record.provenance.originalFilename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}else{const bytes=new Uint8Array(await blob.arrayBuffer());if(!controller.signal.aborted)setContextPdf({data:bytes,title:reference.title})}}
   catch{if(!controller.signal.aborted)setContextError('The referenced PDF could not be opened. Its source or existing permission requires review.')}
   finally{if(!controller.signal.aborted)setContextBusy(false)}
  }
  useEffect(()=>{const sync=()=>{const state=readLocation();setView(state.view);setSelected(state.selected);window.scrollTo({top:0,behavior:'instant'})};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[])
  const hardwareDocument=data?.documents.find(record=>data.evidenceReviews?.find(review=>review.recordId===record.id)?.metadata['documents.category']==='hardware-investment')
  async function downloadHardware(id:string){if(!data?.localDocumentPreviewIds?.includes(id))return;try{const record=data.documents.find(r=>r.id===id)!;const response=await localReviewFetch('assets/'+id);const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=record.provenance.originalFilename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setError('The server upgrade proposal could not be downloaded. Please retry.')}}
  useEffect(() => { document.title = 'JB³ Private Investment Vault: Confidential / Bruce Blackburn' }, [])
  useEffect(() => { if (view === 'reader'||view==='laboratory') document.querySelector<HTMLElement>('.reader h1')?.focus() }, [view, selected])
  return <MotionConfig reducedMotion="user"><LeatherBackground><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell"><header className="site-header"><button className="brand" aria-label="JB³ vault home" onClick={() => navigate('console')}>JB<sup>3</sup></button><span className="brand-divider" /><span className="brand-title">PRIVATE INVESTMENT VAULT</span><span className="edition"><span className="status-light" />Confidential / Bruce Blackburn</span></header>{data && <HiFiNavigation active={view} onReadingRoom={()=>navigate('reading-room')} onDocuments={() => navigate('documents')} onFinances={() => navigate('finances')} onBriefing={() => navigate('briefing')} onPortfolio={() => {setBrochureRecord(undefined);navigate('portfolio')}} />}
    {error ? <main id="main-content" className="entry"><h1>Private content unavailable.</h1><p role="alert">{error}</p><button className="primary-button" onClick={() => { setError(''); setRetry(value => value + 1) }}>Retry presentation</button></main> : !data || !section ? <main id="main-content" className="entry"><p role="status">Opening the presentation…</p></main> : view==='reading-room'?<ReadingRoom sections={sections} selected={lastRead.current} onOpen={open} onLaboratory={openLaboratory} onBack={()=>navigate('console')}/>: view === 'console' ? <ConsoleFrame sections={sections} selected={section} onSelect={setSelected} onOpen={open} onLaboratory={openLaboratory} /> : view === 'reader' ? <SectionReader section={section} navigation={{ sections: sections, onNavigate: open, onLaboratory: openLaboratory }} onBack={() => navigate('console')} onNext={selected==='history-evidence'?openLaboratory:next ? () => open(next.id) : undefined} nextLabel={selected==='history-evidence'?'Next: Laboratory development':undefined} narrativeAfterBlock={index=>{const items=references.filter(reference=>reference.afterBlock===index);return items.length?<div className="context-reference-group">{items.map(reference=><ContextualDocumentReference key={reference.id} reference={reference} busy={contextBusy} onView={(reference,trigger)=>void retrieveContext(reference,false,trigger)} onDownload={reference=>void retrieveContext(reference,true)} onGallery={openLaboratory}/>)}</div>:null}} richNarrative narrativeState={{ status: 'ready', records: [data.sections.find(item => item.id === selected)!.narrative] }}>
      {contextBusy&&<p role="status">Opening referenced document...</p>}{contextError&&<p role="alert">{contextError}</p>}
      {selected==='commercial-pipeline'&&data.commercial&&<CommercialRegister review={data.commercial} documents={data.documents} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} onDocument={openBrochure}/>}
      {selected==='assets-claims'&&data.assets&&<AssetsRegister review={data.assets} documents={data.documents} rate={rate} allowed={data.localDocumentPreviewIds} onDocument={openEvidence}/>}
      {['current-position','history-evidence','assets-claims'].includes(selected) && <PrivateDocuments documents={data.documents.filter(record=>!references.some(reference=>reference.id===record.id)).filter(record=>data.evidenceReviews?.find(item=>item.recordId===record.id)?.sectionIds.includes(selected)??selected==='history-evidence')} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} thumbnails={data.thumbnailPreviews}/>}
      {data.sectionVisuals?.filter(item=>item.sectionId===selected).map(item=><SectionVisual key={item.record.id} record={item.record}/>)}
      {selected === 'southern-african-strategy' && <OfficeOptions />}
      {['financial-requirements', 'financial-forecast'].includes(selected) && <section className="content-module"><h2>Personal and business financial schedules</h2><p className="module-note">Working estimates remain draft pending reconciliation and owner approval.</p><div className="structure-tabs">{(['personal', 'business'] as const).map(name => <button key={name} onClick={() => { setSchedule(name); navigate('finances') }}>Open {name} schedule</button>)}</div></section>}
    </SectionReader> : view==='laboratory'?<div className="reader-layout"><ChapterNavigation sections={sections} current="laboratory" onNavigate={open} onLaboratory={openLaboratory} onBack={()=>navigate('console')}/><main id="main-content" className="reader laboratory-interlude-page"><header className="reader-heading"><span className="metadata">INTERLUDE / BETWEEN 03 AND 04</span><h1 tabIndex={-1}>Laboratory development</h1></header><LaboratoryReview laboratory={data.laboratory}/><footer className="reader-footer"><button className="text-button" onClick={()=>open('history-evidence')}>Back to Section 03</button><button className="text-button" onClick={()=>open('assets-claims')}>Continue to Section 04</button></footer></main></div> : view === 'portfolio' ? <Portfolio recordId={brochureRecord} local={data} onBack={() => navigate('console')} /> : view === 'briefing' ? <ExecutiveBriefing assetEstimates={data.assets?.ownerEstimates} sections={sections} onBack={() => navigate('console')} privateExport={{rate,scenario,cashFlow}} /> : <main id="main-content" className="reader"><div className="reader-toolbar"><button className="text-button" onClick={() => navigate('console')}><ArrowLeft size={16} />Back to Console</button><span className="mono">CONFIDENTIAL / BRUCE BLACKBURN</span></div>{view === 'documents' ? <PrivateDocuments fullLibrary targetId={evidenceRecord} notices={data.documentNotices} documents={data.documents} reviews={data.evidenceReviews} allowed={data.localDocumentPreviewIds} thumbnails={data.thumbnailPreviews} /> : <FinancialWorkspace cashFlow={cashFlow} onCashFlow={setCashFlow} hardwareDocument={hardwareDocument?{id:hardwareDocument.id,available:!!data.localDocumentPreviewIds?.includes(hardwareDocument.id)}:undefined} onHardwareDocument={id=>void downloadHardware(id)} data={data.finances} schedule={schedule} onSchedule={setSchedule} rate={rate} onRate={setRate} scenario={scenario} onScenario={setScenario} />}</main>}
    {contextPdf&&<ContextualPdfDialog data={contextPdf.data} title={contextPdf.title} returnFocus={contextFocus.current} onClose={()=>setContextPdf(null)}/>}
    <footer className="site-footer"><span className="footer-brand">JB<sup>3</sup></span><span>/ Jonathan Blackburn</span><span className="footer-rule" /><span>Private by intention.</span><BuildReference/><button className="footer-exit" onClick={onReplay} aria-label="Replay introduction" title="Replay introduction"><ArrowLeft size={16} /></button></footer></div></LeatherBackground></MotionConfig>
}
