import { HistoricalTimeline } from './HistoricalTimeline'
import { EvidenceGallery } from './EvidenceGallery'
import { OpportunityPipeline } from './OpportunityPipeline'
import { FinancialDashboard } from './FinancialDashboard'
import { InvestmentStructures } from './InvestmentStructures'
import type { VaultSection } from '../types'
export function SectionModules({ section }: { section: VaultSection }) {
  if (section.verification !== 'DEMONSTRATION') return null
  if (section.id === 'history-evidence') return <><HistoricalTimeline /><EvidenceGallery images={section.images} /></>
  if (section.id === 'commercial-pipeline') return <OpportunityPipeline />
  if (section.id === 'financial-forecast' || section.id === 'financial-requirements') return <FinancialDashboard />
  if (section.id === 'investment-structures') return <InvestmentStructures />
  return null
}
