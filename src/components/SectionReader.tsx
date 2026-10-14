import { ArrowLeft, ArrowRight, FileCheck2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'

export function SectionReader({ section, onBack, onNext, children }: { section: VaultSection; onBack: () => void; onNext?: () => void; children?: ReactNode }) {
  return <main id="main-content" className="reader"><div className="reader-toolbar"><button className="text-button" onClick={onBack}><ArrowLeft size={16} />Back to Console</button><span className="mono">{section.disclosure} / {section.verification}</span></div>
    <header className="reader-heading"><div className="reader-number">{sectionNumber(section.number)} <span>/ {section.title}</span></div><h1 tabIndex={-1}>{section.subtitle}</h1><p>{section.overview}</p></header>
    <div className="reader-body"><article>{section.narrative.map(item => <section className="narrative" key={item.heading}><h2>{item.heading}</h2><p>{item.body}</p></section>)}{children}</article><aside className="evidence-aside"><FileCheck2 size={22} /><h2>Evidence & provenance</h2>{section.evidence.map(item => <div key={item.id}><span className="metadata">{item.status}</span><h3>{item.title}</h3><p>{item.description}</p></div>)}<dl><dt>Last updated</dt><dd>{new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(section.updated_at))}</dd><dt>Disclosure level</dt><dd>{section.disclosure}</dd></dl></aside></div>
    <footer className="reader-footer"><span className="mono">JB³ / {section.verification === 'DEMONSTRATION' ? 'SYNTHETIC DEMONSTRATION' : section.disclosure}</span>{onNext && <button className="text-button" onClick={onNext}>Next section <ArrowRight size={16} /></button>}</footer>
  </main>
}
