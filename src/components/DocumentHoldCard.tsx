import { FileText, LockKeyhole } from 'lucide-react'
import type { DocumentNotice } from '../lib/localReview'

export function DocumentHoldCard({ notice }: { notice: DocumentNotice }) {
  return <article className="evidence-review-card portfolio-card document-hold-card" data-document-hold={notice.recordId ?? 'missing-source'}>
    <div className="evidence-preview-placeholder"><FileText size={38} strokeWidth={1} aria-hidden="true"/><span>Original file unpublished</span></div>
    <div className="portfolio-card-body"><span className="portfolio-association">{notice.association}</span><h3>{notice.title}</h3>
      <p className="portfolio-status">{notice.status}</p><p className="metadata">{notice.classification} / OWNER REVIEW REQUIRED</p>
      <p className="module-note">{notice.reason}</p><p className="portfolio-withheld"><LockKeyhole size={14} aria-hidden="true"/>View PDF and Download PDF unavailable until explicitly authorised.</p>
      <details><summary>Document association &amp; publication status</summary><p>{notice.filename ?? 'Canonical source PDF not located. No substitute has been assigned.'}</p><p>Sections: {notice.sectionIds.map(id=>id.replaceAll('-', ' ')).join(', ')}</p><p>The presentation PIN does not authorise restricted source access.</p></details>
    </div>
  </article>
}
