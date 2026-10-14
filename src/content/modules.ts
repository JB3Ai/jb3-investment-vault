export const timeline = [
  { year: '2024', title: 'Establish the record', description: 'Reserve this period for verified milestones, dated correspondence and source records. No events have been asserted.', required: ['Dated operating records', 'Ownership and role evidence', 'Approved milestone narrative'] },
  { year: '2025', title: 'Trace the progression', description: 'Connect the approved chronology to the present position. No commercial outcomes or delivery milestones are claimed.', required: ['Dated delivery evidence', 'Reconciled financial records', 'Documented decisions and outcomes'] },
]
export const pipelineStages = ['Exploration', 'Qualified', 'Proposal', 'Diligence', 'Signed'] as const
export type PipelineStage = typeof pipelineStages[number]
export interface Opportunity { id: string; name: string; sector: string; stage: PipelineStage; value: number; probability: number }
export const demoOpportunities: Opportunity[] = [
  { id: 'demo-01', name: 'Illustrative opportunity A', sector: 'Technology services', stage: 'Exploration', value: 300000, probability: 10 },
  { id: 'demo-02', name: 'Illustrative opportunity B', sector: 'Laboratory services', stage: 'Qualified', value: 500000, probability: 25 },
  { id: 'demo-03', name: 'Illustrative opportunity C', sector: 'Regional delivery', stage: 'Proposal', value: 200000, probability: 40 },
]
export const structures = [
  { name: 'Equity participation', description: 'Ownership aligned with long-term value creation.', terms: ['Ownership percentage: not agreed', 'Valuation: not supplied', 'Governance and dilution: to negotiate'], consideration: 'Diligence would examine ownership, governance, valuation and exit rights.' },
  { name: 'Shareholder loan', description: 'Capital provided under a documented lending agreement.', terms: ['Principal and interest: not agreed', 'Repayment schedule: not agreed', 'Security and ranking: to negotiate'], consideration: 'Diligence would examine repayment capacity, security, ranking and covenants.' },
  { name: 'Commercial joint venture', description: 'A defined collaboration around an agreed commercial scope.', terms: ['Contributions: not agreed', 'Revenue or profit share: not agreed', 'Scope and duration: to negotiate'], consideration: 'Diligence would examine responsibilities, economics, intellectual property and termination.' },
]
