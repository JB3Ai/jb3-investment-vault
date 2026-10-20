import { Calculator, Files, Printer, BookOpen } from 'lucide-react'
import '../styles/hifi-navigation.css'

export function HiFiNavigation({ active, onDocuments, onFinances, onBriefing, onPortfolio }: {
  active?: string; onDocuments: () => void; onFinances: () => void; onBriefing: () => void; onPortfolio: () => void
}) {
  return <nav className="utility-nav hifi-nav" aria-label="Vault tools">
    {[
      { id: 'documents', label: 'Documents', Icon: Files, action: onDocuments },
      { id: 'finances', label: 'Financial schedules', Icon: Calculator, action: onFinances },
      { id: 'briefing', label: 'Executive briefing', Icon: Printer, action: onBriefing },
      { id: 'portfolio', label: 'Portfolio', Icon: BookOpen, action: onPortfolio },
    ].map(({ id, label, Icon, action }) => <button key={id} onClick={action} aria-current={active === id ? 'page' : undefined}>
      <span className="hifi-indicator" aria-hidden="true" /><Icon size={15} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </nav>
}
