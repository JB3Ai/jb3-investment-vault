import {EvidencePreview,type CoverPreview} from './EvidencePreview'
import { LockKeyhole } from 'lucide-react'
import type { DocumentNotice } from '../lib/localReview'

export function DocumentHoldCard({ notice,thumbnail }: { notice: DocumentNotice;thumbnail?:CoverPreview }) {
  return <article className="evidence-review-card portfolio-card document-hold-card" data-document-hold={notice.recordId ?? 'missing-source'}>
    <EvidencePreview title={notice.title} thumbnail={thumbnail}/>
    <div className="portfolio-card-body"><span className="portfolio-association">{notice.category??notice.association}</span><h3>{notice.title}</h3>
      <p className="portfolio-status">{notice.status}</p><p className="metadata">{notice.classification} / OWNER REVIEW REQUIRED</p>
      <p className="module-note">{notice.reason}</p><p className="portfolio-withheld"><LockKeyhole size={14} aria-hidden="true"/>View PDF and Download PDF unavailable until explicitly authorised.</p>
      <details><summary>Document association &amp; publication status</summary><p>{notice.filename ?? 'Canonical source PDF not located. No substitute has been assigned.'}</p><p>Sections: {notice.sectionIds.map(id=>id.replaceAll('-', ' ')).join(', ')}</p><p>The presentation PIN does not authorise restricted source access.</p></details>
    </div>
  </article>
}
