export interface AssetReviewEntry {
  id:string; title:string; category:'disputed-recovery'|'equipment'|'intellectual-property'
  classification:'BRUCE_PRIVATE'|'LEGAL_RESTRICTED'; approval:'draft'; verification:'documented'|'reported'|'disputed'|'awaiting-verification'
  sourceDocumentIds:string[]; claimedValueMinor:number|null; valuationBasis:string; ownershipEvidence:string; encumbrances:string; claimStage:string
  nextHearing:string|null; hearingVerified:boolean; recoveryEstimateMinor:number|null; recoveryBasis:string|null; verifiedAvailableMinor:number|null
  modelContributionMinor:0; verificationNotes:string[]
}
export interface AssetReview {format:'JB3_ASSET_REVIEW_V1'; classification:'BRUCE_PRIVATE'; approval:'draft'; source:{relativePath:string;sha256:string;originalFilename:string}; entries:AssetReviewEntry[]}
/** Recipient derivatives never acquire restricted legal metadata from the owner review. */
export function recipientAssetSummaries(review:AssetReview|undefined){return review?.entries.filter(entry=>entry.classification==='BRUCE_PRIVATE')??[]}
