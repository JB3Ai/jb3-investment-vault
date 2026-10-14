import { ArrowUpRight } from 'lucide-react'
import { sectionNumber } from '../content/registry'
import type { VaultSection } from '../types'

export function SectionIndex({ sections, selected, onSelect, onOpen }: { sections: VaultSection[]; selected: string; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  return <nav className="section-index" aria-label="Section index">{[{ title: 'Context', items: sections.filter(s => s.number <= 4) }, { title: 'Future', items: sections.filter(s => s.number > 4) }].map(group => <div className="index-group" key={group.title}><h2>{group.title}<span>{group.title === 'Context' ? '01 — 04' : '05 — 11'}</span></h2><ol>{group.items.map(s => <li key={s.id} className={selected === s.id ? 'selected' : ''}><button aria-current={selected === s.id ? 'true' : undefined} onClick={() => onSelect(s.id)}><span>{sectionNumber(s.number)}</span>{s.title}</button><button className="index-open" aria-label={`Open ${s.title}`} onClick={() => onOpen(s.id)}><ArrowUpRight size={16} /></button></li>)}</ol></div>)}</nav>
}
