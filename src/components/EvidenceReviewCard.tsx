import {presentationView,presentationText} from '../lib/presentationCopy'
import type { ReactNode } from 'react'
import { EvidencePreview } from './EvidencePreview'
import { FileText, LockKeyhole } from 'lucide-react'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
import type { EvidenceReview } from '../lib/localReview'
import { demoSections } from '../content/registry'
import '../styles/evidence-review.css'

export function EvidenceReviewCard({record,review,preview,actions}:{record:ContentRecord;review:EvidenceReview;preview?:ReactNode;actions?:ReactNode}) {
  record=presentationView(record);review=presentationView(review)
  return <article className="evidence-review-card" data-evidence-record={record.id}>
    <div className="module-heading"><h3><FileText size={20}/>{record.payload.title}</h3><span className="metadata">{record.classification}</span></div>
    <p className="evidence-review-status">DRAFT EVIDENCE / OUTSTANDING VERIFICATION</p>
    {preview??<EvidencePreview title={String(record.payload.title)}/>}
    <p className="evidence-card-category">{record.classification==='LEGAL_RESTRICTED'?'Restricted legal evidence':'Private supporting evidence'}</p>
    <p>{review.summary}</p>
    <p className="module-note">Sections {review.sectionIds.map(id=>String(demoSections.findIndex(section=>section.id===id)+1).padStart(2,'0')).join(' / ')} · {review.pageCount} pages · {record.verification}</p>
    <details><summary>Review findings and provenance</summary>
      <h4>Document assertions / allegations</h4><ul>{review.assertions.map((item,index)=><li key={index}>{item}</li>)}</ul>
      <h4>Independently verified facts</h4><ul>{review.independentlyVerifiedFacts.map((item,index)=><li key={index}>{item}</li>)}</ul>
      <h4>Verification holds</h4><ul>{review.verificationHolds.map((item,index)=><li key={index}>{item}</li>)}</ul>
      <dl>{[['Original filename',record.provenance.originalFilename],['Source date',record.provenance.sourceDate??'Unknown / not authenticated'],['Citation',record.provenance.citation],['Source checksum',record.provenance.sourceReference],['Unresolved matters',record.provenance.conflictNote??'No independent verification recorded'],['Record',record.id]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      <h4>PDF-reported metadata: not authenticated</h4><dl>{Object.entries(review.metadata).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value?(/^(?:portfolio|brochure)\./.test(key)?presentationText(value):value):'Not supplied'}</dd></div>)}</dl>
    </details>
    {actions ? <>{actions}<p className="module-note"><LockKeyhole size={14}/>Confidential / Bruce Blackburn. Draft evidence remains subject to verification.</p></> : <p className="module-note"><LockKeyhole size={14}/>PDF viewing and download access withheld. Registration is not approval or an access grant.</p>}
  </article>
}
