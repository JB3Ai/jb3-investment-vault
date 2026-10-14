import type { VaultSection } from '../types'

// This entire registry is synthetic and safe to include in a public JavaScript bundle.
// Confidential material belongs in the RLS-protected database, never in this file.
const definitions = [
  ['introduction', 'Introduction', 'A considered beginning.', 'An introduction to Jonathan Blackburn, JB³ and the proposed strategic relationship with Beobacht.', 'The purpose of this vault', 'This demonstration provides a framework for a considered investment conversation. It brings the context, supporting evidence and possible future structures into one place. A verified founder biography and approved executive statement have not yet been supplied.'],
  ['current-position', 'Current Position', 'Clarity before commitment.', 'A structured view of the present position, with evidence before assumptions.', 'Establishing the baseline', 'An approved operating summary, liabilities schedule, current resources and verified income position are required. This section intentionally makes no claims about solvency, revenue or available capital.'],
  ['history-evidence', 'History & Evidence', 'The record behind the vision.', 'Explore the 2024–2025 chronology and the proposed COVID laboratory case study.', 'A record to be substantiated', 'The timeline and laboratory gallery are editorial placeholders. Dates, ownership, laboratory activities, certifications and outcomes require source documents and permission to publish. No laboratory photograph or operational claim has been supplied.'],
  ['assets-claims', 'Assets & Claims', 'Substance, with provenance.', 'An evidence-led register of assets, intellectual property and claims.', 'Ownership must be documented', 'Asset descriptions, valuation reports, legal title and any encumbrances remain to be supplied. A listing in this vault does not establish ownership, valuation or enforceability.'],
  ['financial-requirements', 'Financial Requirements', 'Capital with a clear purpose.', 'Frame the funding need, the use of proceeds and the milestones it would support.', 'Defining the requirement', 'The funding amount and use-of-funds schedule have not been agreed. Working capital, delivery costs and contingency can be explored in the hypothetical financial model. All model inputs are illustrative.'],
  ['beobacht-alignment', 'Beobacht Alignment', 'Alignment before acceleration.', 'A proposed strategic relationship, built around complementary objectives.', 'A conversation, not a commitment', 'This section is reserved for the proposed relationship between JB³ and Beobacht. Scope, responsibilities, governance and commercial terms require mutual review. No endorsement, partnership or signed commitment is represented.'],
  ['commercial-pipeline', 'Commercial Pipeline', 'Opportunity, in perspective.', 'Separate early conversations from qualified opportunities and signed business.', 'A disciplined opportunity register', 'The sample register illustrates how opportunities can progress through defined stages. All entries are synthetic. There are no represented customer contracts, committed revenues or actual counterparty names.'],
  ['southern-african-strategy', 'Southern African Strategy', 'A regional view. A deliberate pace.', 'A framework for assessing delivery and growth across Southern Africa.', 'Validate each market', 'An approved market assessment, priority countries, local partners and regulatory requirements remain to be supplied. A potential market is not evidence of demand, market access or delivery readiness.'],
  ['financial-forecast', 'Financial Forecast', 'Assumptions in the open.', 'An adjustable model that keeps confirmed income, prospects and hypotheses distinct.', 'Explore the assumptions', 'Use the controls to explore an illustrative operating scenario. No actual financial data has been supplied. The model is a simple planning aid; it excludes tax, financing costs, working-capital timing and capital expenditure. It is not a valuation or a promised investment return.'],
  ['investment-structures', 'Investment Structures', 'The shape of a shared future.', 'Compare three possible structures before developing formal terms.', 'Structure follows diligence', 'Equity participation, a shareholder loan and a commercial joint venture are shown as discussion frameworks only. Pricing, ownership, repayment, rights, security and obligations have not been agreed. Professional review and signed documentation would be required.'],
  ['closing', 'Closing', 'Begin with a conversation.', 'Turn considered interest into a clear and documented next step.', 'A measured next step', 'The next step is to verify the evidence, agree the scope of diligence and establish decision criteria. No acceptance of investment or binding offer is made through this demonstration. Contact details and an approved next-step process remain to be supplied.'],
] as const

export const demoSections: VaultSection[] = definitions.map(([id, title, subtitle, overview, heading, body], index) => ({
  id, number: index + 1, title, subtitle, overview,
  narrative: [{ heading, body }],
  evidence: [{ id: `${id}-source`, title: 'Source material pending', description: 'Approved source evidence has not been supplied.', status: 'PENDING', source: null }],
  images: id === 'history-evidence' ? [
    { id: 'lab-space', caption: 'Laboratory environment — photograph pending', alt: 'Reserved for a verified photograph of the laboratory environment', url: null },
    { id: 'lab-process', caption: 'Process and equipment — photograph pending', alt: 'Reserved for a verified photograph of laboratory equipment', url: null },
    { id: 'lab-team', caption: 'People and delivery — photograph pending', alt: 'Reserved for an approved photograph of the laboratory team', url: null },
  ] : [],
  documents: [], updated_at: '2026-10-13', verification: 'DEMONSTRATION', disclosure: 'COMMERCIAL',
}))

export const sectionNumber = (number: number) => String(number).padStart(2, '0')
