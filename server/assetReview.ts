import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { privateFile } from '../content-migration/local-importer.ts'
import type { ContentManifest } from '../content-migration/ingestion-schema.ts'
import type { AssetReview } from '../src/lib/assetReview.ts'
export function parseAssetReview(value:unknown,manifest:ContentManifest):AssetReview{
 const review=value as AssetReview,records=new Map(manifest.sections.flatMap(s=>s.records.map(r=>[r.id,r] as const)))
 const amount=(v:unknown)=>v===null||Number.isSafeInteger(v)&&Number(v)>=0
 if(!review||review.format!=='JB3_ASSET_REVIEW_V1'||review.classification!=='BRUCE_PRIVATE'||review.approval!=='draft'||!review.source?.originalFilename||!/^[a-f0-9]{64}$/.test(review.source.sha256)||!Array.isArray(review.entries)||new Set(review.entries.map(e=>e.id)).size!==review.entries.length)throw Error('Invalid asset review')
 for(const entry of review.entries){
  if(!/^[a-f0-9-]{36}$/.test(entry.id)||typeof entry.title!=='string'||!entry.title.trim()||/custody/i.test(entry.title)||!['disputed-recovery','equipment','intellectual-property'].includes(entry.category)||!['BRUCE_PRIVATE','LEGAL_RESTRICTED'].includes(entry.classification)||entry.approval!=='draft'||!['documented','reported','disputed','awaiting-verification'].includes(entry.verification)||![entry.claimedValueMinor,entry.recoveryEstimateMinor,entry.verifiedAvailableMinor].every(amount)||entry.modelContributionMinor!==0||![entry.valuationBasis,entry.ownershipEvidence,entry.encumbrances,entry.claimStage].every(v=>typeof v==='string'&&v.trim())||!Array.isArray(entry.verificationNotes)||!entry.verificationNotes.length||entry.verificationNotes.some(v=>typeof v!=='string'||!v.trim())||!Array.isArray(entry.sourceDocumentIds))throw Error('Invalid asset entry')
  if(entry.nextHearing!==null&&(!entry.hearingVerified||!/^\d{4}-\d{2}-\d{2}$/.test(entry.nextHearing)||!Number.isFinite(Date.parse(entry.nextHearing))||new Date(entry.nextHearing).toISOString().slice(0,10)!==entry.nextHearing||!entry.sourceDocumentIds.some(id=>records.get(id)?.verification==='documented'&&records.get(id)?.approval==='approved')))throw Error('Unverified hearing date')
  if(entry.verifiedAvailableMinor!==null&&(entry.verification!=='documented'||!entry.sourceDocumentIds.some(id=>records.get(id)?.verification==='documented'&&records.get(id)?.approval==='approved')))throw Error('Available amount is not independently supported')
  if(entry.recoveryEstimateMinor!==null&&(!entry.recoveryBasis||!entry.sourceDocumentIds.length))throw Error('Unsupported recovery estimate')
  for(const id of entry.sourceDocumentIds){const source=records.get(id);if(!source||source.kind!=='pdf'||/custody/i.test(String(source.payload.title))||source.classification==='LEGAL_RESTRICTED'&&entry.classification!=='LEGAL_RESTRICTED')throw Error('Asset evidence classification mismatch')}
 }
 return review
}
export async function loadAssetReview(root:string,manifest:ContentManifest){
 let value
 try{value=JSON.parse(await readFile(await privateFile(root,'intake-supporting-evidence-01/review/assets-review.json'),'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error}
 const review=parseAssetReview(value,manifest)
 if(createHash('sha256').update(await readFile(await privateFile(root,review.source.relativePath))).digest('hex')!==review.source.sha256)throw Error('Asset owner-source checksum mismatch')
 return review
}
