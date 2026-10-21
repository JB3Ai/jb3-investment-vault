export interface AssetReviewEntry {
  id:string; title:string; category:'disputed-recovery'|'equipment'|'intellectual-property'
  classification:'BRUCE_PRIVATE'|'LEGAL_RESTRICTED'; approval:'draft'; verification:'documented'|'reported'|'disputed'|'awaiting-verification'
  sourceDocumentIds:string[]; claimedValueMinor:number|null; valuationBasis:string; ownershipEvidence:string; encumbrances:string; claimStage:string
  nextHearing:string|null; hearingVerified:boolean; recoveryEstimateMinor:number|null; recoveryBasis:string|null; verifiedAvailableMinor:number|null
  modelContributionMinor:0; verificationNotes:string[]
}
/** Owner-reported discussion ranges, never inputs to funding, forecasts or repayments. */
export interface OwnerAssetEstimates {
 classification:'BRUCE_PRIVATE'; verification:'reported'; owner:string; recordedOn:string
 source:{relativePath:string;sha256:string;originalFilename:string}
 heading:string; subtitle:string; combinedNote:string; rangeNote:string; ipNote:string
 entries:{key:'micore'|'kula'|'code';label:string;lowMinor:number;highMinor:number;note:string}[]
 briefing:{heading:string;paragraphs:string[]}
}
export function ownerEstimateRange(estimates:OwnerAssetEstimates){
 return estimates.entries.reduce((sum,entry)=>({lowMinor:sum.lowMinor+entry.lowMinor,highMinor:sum.highMinor+entry.highMinor}),{lowMinor:0,highMinor:0})
}
export interface AssetReview {format:'JB3_ASSET_REVIEW_V1'; classification:'BRUCE_PRIVATE'; approval:'draft'; source:{relativePath:string;sha256:string;originalFilename:string}; entries:AssetReviewEntry[]; ownerEstimates?:OwnerAssetEstimates}
/** Recipient derivatives never acquire restricted legal metadata from the owner review. */
export function recipientAssetSummaries(review:AssetReview|undefined){return review?.entries.filter(entry=>entry.classification==='BRUCE_PRIVATE')??[]}
