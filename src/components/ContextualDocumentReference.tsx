import {Download,FileText,Images,LockKeyhole} from 'lucide-react'
import type {NarrativeReference} from '../lib/narrativeReferences'
import '../styles/contextual-documents.css'
export function ContextualDocumentReference({reference,busy,onView,onDownload,onGallery}:{reference:NarrativeReference;busy:boolean;onView:(reference:NarrativeReference,trigger:HTMLButtonElement)=>void;onDownload:(reference:NarrativeReference)=>void;onGallery:()=>void}){
 return <aside className="context-document" aria-label={'Supporting reference: '+reference.title} data-context-reference={reference.id}>
  {reference.kind==='gallery'?<Images size={19} aria-hidden="true"/>:<FileText size={19} aria-hidden="true"/>}<div><strong>{reference.title}</strong><small>{reference.kind==='gallery'?'Private photographs / chronology unverified':reference.record?.classification+' / '+reference.record?.approval}</small><div className="context-document-actions">{reference.kind==='gallery'?<button className="file-action" onClick={onGallery}>Open photo gallery</button>:<><button className="file-action" disabled={!reference.available||busy} onClick={event=>onView(reference,event.currentTarget)}>View PDF</button>{reference.available?<button className="file-action" disabled={busy} onClick={()=>onDownload(reference)} aria-label={'Download PDF: '+reference.title}><Download size={15}/>Download</button>:<span className="context-access-hold"><LockKeyhole size={12}/>Document access pending</span>}</>}</div></div>
 </aside>
}
