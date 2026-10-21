import type {LocalReview} from '../src/lib/localReview'
export type VisualPublicationApprovals=Record<string,{scope?:string}>
/** Private originals stay draft; only a separately approved presentation copy is eligible. */
export function presentationVisuals(visuals:LocalReview['sectionVisuals'],approvals:VisualPublicationApprovals){
 return (visuals??[]).filter(({record})=>record.kind==='photograph'&&record.classification==='BRUCE_PRIVATE'&&record.approval!=='rejected'&&record.file&&['image/png','image/jpeg','image/webp'].includes(record.file.mimeType)&&approvals[record.file.sha256]?.scope==='public-presentation-visual')
}

/** A drive-path token is distinct from the colon inside an HTTPS URL. */
export function privateSourcePath(value:string){return /(?:^|[^A-Za-z])[A-Za-z]:[\\/]|\\\\Users\\/.test(value)}
