import {presentationView} from '../lib/presentationCopy'
import { Fragment } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'
import '../styles/reader-navigation.css'

export interface ReaderNavigation { sections: VaultSection[]; onNavigate: (id: string) => void; onLaboratory?: () => void }
export function ChapterNavigation({ sections, current, onNavigate, onBack, onLaboratory }: ReaderNavigation & { current: string; onBack: () => void }) {
  sections=presentationView(sections)
  return <aside className="chapter-navigation" aria-label="Reader contents">
    <button className="text-button chapter-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to Console</button>
    <nav className="chapter-list" aria-label="Investment chapters"><h2>Contents</h2><ol>{sections.map(section => <Fragment key={section.id}><li><button aria-current={section.id === current ? 'page' : undefined} onClick={() => onNavigate(section.id)}><span>{sectionNumber(section.number)}</span><span>{section.title}</span></button></li>{section.number===3&&onLaboratory&&<li className="chapter-interlude"><button aria-current={current==='laboratory'?'page':undefined} onClick={onLaboratory}><span>◇</span><span>23-day laboratory development</span></button></li>}</Fragment>)}</ol></nav>
    <label className="chapter-selector">Contents<select aria-label="Investment chapter" value={current} onChange={event => event.target.value==='laboratory'?onLaboratory?.():onNavigate(event.target.value)}>{sections.map(section => <Fragment key={section.id}><option value={section.id}>{sectionNumber(section.number)} / {section.title}</option>{section.number===3&&onLaboratory&&<option value="laboratory">Interlude / 23-day laboratory development</option>}</Fragment>)}</select></label>
  </aside>
}
