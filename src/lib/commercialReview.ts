export const commercialCategories = {
  prototype: 'Prototype / Proof of Concept',
  'strategic-showcase': 'Strategic Technical Showcase',
  'potential-distribution': 'Potential Distribution Opportunity',
  'repeatable-service': 'Repeatable Commercial Service Offering',
  'education-impact': 'Education / AI for Good Showcase',
} as const
export interface CommercialEntry {
  recordId: string; title: string; category: keyof typeof commercialCategories; positioning: string; limitations: string[]
  sourceDocuments: { recordId: string; relation: 'technical-context' | 'internal-audit' | 'subject-brochure'; citation: string }[]
  quotedValues: { amountMinor: number; currency: 'ZAR' | 'GBP'; sourceDocumentId: string; citation: string; treatment: 'historical-quoted-or-proposed' }[]
  missingEvidence: string[]; confirmedRevenueMinor: null; forecastContributionMinor: 0; assetContributionMinor: 0; thirdPartyIp: boolean; ownershipNote: string | null
}
export interface CommercialReview {
  format: 'JB3_COMMERCIAL_REVIEW_V1'; classification: 'BRUCE_PRIVATE'; approval: 'draft'; owner: string; recordedOn: string
  source: { relativePath: string; originalFilename: string; sha256: string }
  entries: CommercialEntry[]
}
/** Presentation exclusions never remove private source records or their history. */
export function commercialDocumentVisible(document: { title: string; originalFilename: string; association?: string; excludedFromCommercial?: boolean }) {
  return !document.excludedFromCommercial && !/sunday[\s_-]*world/i.test([document.title, document.originalFilename, document.association ?? ''].join(' '))
}
export function commercialForecastMinor(review: CommercialReview | undefined) {
  // No contract-backed, reconciled revenue source is part of this review.
  if (review?.entries.some(entry => entry.forecastContributionMinor !== 0)) throw Error('Uncontracted commercial revenue must not enter the forecast')
  return 0
}
