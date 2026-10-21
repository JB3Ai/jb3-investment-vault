import {CommercialRevenueScenario} from './CommercialRevenueScenario'
import {commercialDisclosure} from '../lib/commercialScenario'
import {presentationView} from '../lib/presentationCopy'
import { ArrowUpRight, FileText } from 'lucide-react'
import { brochureDocument } from '../lib/brochures'
import type { EvidenceReview } from '../lib/localReview'
import { commercialDocumentVisible, commercialCategories, type CommercialReview } from '../lib/commercialReview'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
import '../styles/commercial-register.css'
export function CommercialRegister({ review, documents, reviews = [], allowed = [], onDocument }: { review: CommercialReview; documents: ContentRecord[]; reviews?: EvidenceReview[]; allowed?: string[]; onDocument: (id: string) => void }) {
  review=presentationView(review)
 return <section className="content-module commercial-register" aria-label="Commercial Capability & Opportunity Register">
    <div className="module-heading"><h2>Commercial Capability &amp; Opportunity Register</h2><span className="metadata">Owner-confirmed positioning / draft evidence</span></div>
    <p className="commercial-disclosure">{commercialDisclosure}</p><CommercialRevenueScenario/>
    <div className="commercial-entry-list">{review.entries.map(entry => <article key={entry.recordId} data-commercial-record={entry.recordId}>
      <header><h3>{entry.title}</h3><span className="commercial-category">{commercialCategories[entry.category]}</span></header><p>{entry.positioning}</p>

      {entry.thirdPartyIp && <p className="commercial-ip">{entry.ownershipNote}</p>}
      <div className="commercial-document-links">{entry.sourceDocuments.map(source => { const document = documents.find(record => record.id === source.recordId); return document && document.classification === 'BRUCE_PRIVATE' && commercialDocumentVisible(brochureDocument(document,reviews.find(review=>review.recordId===document.id)?.metadata)) ? <div key={source.recordId}><button className="text-button file-action" onClick={() => onDocument(source.recordId)}><FileText size={15} aria-hidden="true" /><span>{String(document.payload.title).replace(/\.pdf$/i,'')}</span><ArrowUpRight size={14} aria-hidden="true" /></button><small>{source.relation === 'technical-context' ? 'Related technical context; not engagement or deployment proof' : source.relation === 'internal-audit' ? 'Internal audit context; not independent commercial evidence' : 'Subject brochure / draft'}{!allowed.includes(source.recordId) && ' / source-file access withheld'}</small></div> : null })}</div>
      <details><summary>Commercial limits &amp; evidence</summary><ul>{entry.limitations.map(note => <li key={note}>{note}</li>)}</ul>{entry.sourceDocuments.map(source => <p key={source.recordId}>{source.citation}</p>)}{entry.missingEvidence.map(note => <p className="commercial-pending" key={note}>{note}</p>)}{entry.quotedValues.map((quote,index) => <p key={index}>Historical quoted / proposed value only: {new Intl.NumberFormat('en-ZA',{style:'currency',currency:quote.currency}).format(quote.amountMinor/100)}. {quote.citation}. Excluded from revenue and funding requirements.</p>)}<p>Owner clarification: {review.owner}, {review.recordedOn}. Source approval and independent verification remain separate.</p></details>
    </article>)}</div>
  </section>
}
