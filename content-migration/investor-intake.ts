/** Source requests only. Do not put personal records or populated imports in Git. */
import type { Disclosure, VaultSection } from '../src/types'
import { emptyPhase2Import, type SectionId, type Phase2Import, type NarrativeImport, type PhotographImport, type PdfImport, type OpportunityImport, type FinancialFigureImport } from './phase2'

export interface InvestorTopic {
  id: string
  requestedTopic: string
  requiredSources: readonly string[]
  disclosure: Disclosure
}
export interface InvestorSectionRequest {
  sectionId: SectionId
  topics: readonly InvestorTopic[]
}

// Labels describe the requested editorial scope, not verified facts or legal conclusions.
export const investorSectionRequests = [
  { sectionId: 'introduction', topics: [
    { id: 'professional-history', requestedTopic: "Jonathan Blackburn's professional history", disclosure: 'PRIVATE', requiredSources: ['Approved biography/CV', 'Dated role and qualification evidence', 'Publication approval'] },
    { id: 'compounding-architecture', requestedTopic: 'The Compounding Architecture', disclosure: 'PRIVATE', requiredSources: ['Author-approved explanation and diagrams', 'Definitions, examples and supporting evidence', 'Ownership and disclosure approval'] },
  ] },
  { sectionId: 'current-position', topics: [
    { id: 'family-responsibilities', requestedTopic: 'Family circumstances and financial responsibilities', disclosure: 'PRIVATE', requiredSources: ['Owner-approved private summary', 'Dated responsibilities and liabilities schedule', 'Consent and redaction instructions'] },
    { id: 'micore-review', requestedTopic: 'Micore Solutions legal-exposure review', disclosure: 'PRIVATE', requiredSources: ['Relevant agreements and dated correspondence', 'Current legal position from authorised adviser', 'Status of any disputed claims and redacted summary'] },
    { id: 'family-property-review', requestedTopic: 'Family-property legal-exposure review', disclosure: 'PRIVATE', requiredSources: ['Title and encumbrance records', 'Relevant legal documents held outside this repository', 'Authorised current-position summary and redaction approval'] },
  ] },
  { sectionId: 'history-evidence', topics: [
    { id: 'gtr-founder-journey', requestedTopic: 'GTR³ founder journey', disclosure: 'PRIVATE', requiredSources: ['Founder-approved account', 'Dated milestones and role evidence', 'Attribution and publication approval'] },
    { id: 'imed-laboratory-build', requestedTopic: "iMED COVID laboratory build — user-described 23-day duration awaiting verification", disclosure: 'PRIVATE', requiredSources: ['Dated start and completion records supporting the duration', 'Commissioning, operational and role evidence', 'Original photographs, captions and publication permissions'] },
    { id: 'imed-kula-chronology', requestedTopic: '2024–2025 iMED/KULA chronology', disclosure: 'PRIVATE', requiredSources: ['Dated 2024 and 2025 records', 'Attributed correspondence and event schedule', 'Dispute annotations and reviewed chronology'] },
  ] },
  { sectionId: 'assets-claims', topics: [
    { id: 'jb3-products-assets', requestedTopic: 'JB³ products and assets', disclosure: 'PRIVATE', requiredSources: ['Product inventory and maturity/status evidence', 'Ownership and IP records', 'Valuation basis and encumbrances, where applicable'] },
  ] },
  { sectionId: 'financial-requirements', topics: [
    { id: 'immediate-funding', requestedTopic: 'Immediate funding and financial responsibilities', disclosure: 'PRIVATE', requiredSources: ['Itemised use-of-funds schedule', 'Amount, currency, due dates and supporting quotations', 'Approved separation of personal and business obligations'] },
  ] },
  { sectionId: 'beobacht-alignment', topics: [
    { id: 'beobacht-partnership', requestedTopic: 'Proposed Beobacht strategic partnership', disclosure: 'PRIVATE', requiredSources: ['Approved proposed scope and responsibilities', 'Attributed correspondence or signed agreements', 'Mutual permission to describe the relationship'] },
  ] },
  { sectionId: 'commercial-pipeline', topics: [
    { id: 'commercial-pipeline', requestedTopic: 'Commercial pipeline', disclosure: 'PRIVATE', requiredSources: ['Dated opportunity register and counterparties', 'Evidence supporting each stage', 'Currency, prospective value and probability basis; actual income separately reconciled'] },
  ] },
  { sectionId: 'southern-african-strategy', topics: [
    { id: 'regional-strategy', requestedTopic: 'Southern African strategy', disclosure: 'PRIVATE', requiredSources: ['Approved regional strategy and priority markets', 'Market and delivery evidence', 'Documented partner status and constraints'] },
  ] },
  { sectionId: 'financial-forecast', topics: [
    { id: 'financial-forecast', requestedTopic: 'Financial forecast and documented baseline', disclosure: 'PRIVATE', requiredSources: ['Reconciled actual income, costs and opening cash', 'Dated assumptions and calculation method', 'Collection timing, capex, financing and tax treatment or explicit exclusions'] },
  ] },
  { sectionId: 'investment-structures', topics: [
    { id: 'investment-structures', requestedTopic: 'Investment structures', disclosure: 'PRIVATE', requiredSources: ['Proposed equity, shareholder-loan and joint-venture terms', 'Governance, rights, obligations and pricing basis', 'Professional review and clear distinction between proposed and agreed terms'] },
  ] },
  { sectionId: 'closing', topics: [
    { id: 'next-steps', requestedTopic: 'Investor diligence and next steps', disclosure: 'PRIVATE', requiredSources: ['Approved decision process and diligence owner', 'Authorised contact details', 'Publication and disclosure decisions'] },
  ] },
] as const satisfies readonly InvestorSectionRequest[]

export interface InvestorSectionPlaceholder {
  sectionId: SectionId
  number: number
  title: string
  topicIds: string[]
  classification: 'awaiting-verification'
  disclosure: 'PRIVATE'
  approved: false
  /** null means not supplied, not an empty statement, zero or verified absence. */
  narratives: NarrativeImport[] | null
  photographs: PhotographImport[] | null
  pdfs: PdfImport[] | null
  opportunities: OpportunityImport[] | null
  financialFigures: FinancialFigureImport[] | null
}

/** Pass the current registry to bind intake placeholders to exact IDs/titles/order.
 * Output belongs in a private offline workspace once populated, never the browser.
 * This does not promote placeholders to Phase2Import or alter the existing registry.
 */
export function createInvestorIntake(sections: readonly Pick<VaultSection, 'id' | 'number' | 'title'>[]): {
  manifest: Phase2Import; placeholders: InvestorSectionPlaceholder[]
} {
  if (sections.length !== investorSectionRequests.length || new Set(sections.map(s => s.id)).size !== sections.length) throw new Error('Expected the complete eleven-section registry.')
  const placeholders = investorSectionRequests.map((request, index): InvestorSectionPlaceholder => {
    const section = sections[index]
    if (section.id !== request.sectionId || section.number !== index + 1) throw new Error('Registry identity or order differs from the approved intake mapping.')
    return {
      sectionId: request.sectionId, number: section.number, title: section.title,
      topicIds: request.topics.map(t => t.id), classification: 'awaiting-verification', disclosure: 'PRIVATE', approved: false,
      narratives: null, photographs: null, pdfs: null, opportunities: null, financialFigures: null,
    }
  })
  return { manifest: emptyPhase2Import(), placeholders }
}
