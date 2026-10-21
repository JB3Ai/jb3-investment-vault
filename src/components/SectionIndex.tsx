import { Fragment } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { sectionNumber } from '../content/registry'
import type { VaultSection } from '../types'

export function SectionIndex({ sections, selected, onSelect, onOpen, onLaboratory }: { sections: VaultSection[]; selected: string; onSelect: (id: string) => void; onOpen: (id: string) => void; onLaboratory?: () => void }) {
  return <nav className="section-index" aria-label="Section index">{[{ title: 'Context', items: sections.filter(s => s.number <= 4) }, { title: 'Future', items: sections.filter(s => s.number > 4) }].map(group => <div className="index-group" key={group.title}><h2>{group.title}<span>{group.title === 'Context' ? '01 to 04' : '05 to 11'}</span></h2><ol>{group.items.map(s => <Fragment key={s.id}><li className={selected === s.id ? 'selected' : ''}><button aria-current={selected === s.id ? 'true' : undefined} onClick={() => onSelect(s.id)}><span>{sectionNumber(s.number)}</span>{s.title}</button><button className="index-open" aria-label={`Open ${s.title}`} onClick={() => onOpen(s.id)}><ArrowUpRight size={16} /></button></li>{s.number===3&&onLaboratory&&<li className={'index-interlude'+(selected==='laboratory'?' selected':'')}><button aria-current={selected==='laboratory'?'true':undefined} onClick={onLaboratory}><span>◇</span>23-day laboratory development</button><button className="index-open" aria-label="Open laboratory development interlude" onClick={onLaboratory}><ArrowUpRight size={16}/></button></li>}</Fragment>)}</ol></div>)}</nav>
}
