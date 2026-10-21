import {thumbnailReference} from '../src/lib/thumbnailReference.ts'
import type {ContentRecord} from '../content-migration/ingestion-schema'
import type {LocalReview} from '../src/lib/localReview'
export type VisualPublicationApprovals=Record<string,{scope?:string}>
/** Private originals stay draft; only a separately approved presentation copy is eligible. */
export function presentationVisuals(visuals:LocalReview['sectionVisuals'],approvals:VisualPublicationApprovals){
 return (visuals??[]).filter(({record})=>record.kind==='photograph'&&record.classification==='BRUCE_PRIVATE'&&record.approval!=='rejected'&&record.file&&['image/png','image/jpeg','image/webp'].includes(record.file.mimeType)&&approvals[record.file.sha256]?.scope==='public-presentation-visual')
}

/** A drive-path token is distinct from the colon inside an HTTPS URL. */
export function privateSourcePath(value:string){return /(?:^|[^A-Za-z])[A-Za-z]:[\\/]|\\\\Users\\/.test(value)}

export interface CoverPublicationApproval{scope?:string;parentId?:string;parentSha256?:string;previewKind?:string}
export function approvedPresentationCover(record:ContentRecord,parent:ContentRecord,approval:CoverPublicationApproval|undefined,pdfPublished:boolean){
 const link=thumbnailReference(record.provenance.sourceReference)
 return !!(record.kind==='photograph'&&record.approval!=='rejected'&&parent.kind==='pdf'&&record.classification===parent.classification&&record.file?.mimeType==='image/png'&&link?.parentId===parent.id&&link.parentSha256===parent.file?.sha256&&link.imageSha256===record.file.sha256&&approval?.scope==='public-presentation-cover'&&approval.parentId===parent.id&&approval.parentSha256===parent.file.sha256&&(approval.previewKind==='neutral'||pdfPublished&&parent.classification!=='LEGAL_RESTRICTED'&&approval.previewKind==='source-cover'))
}
