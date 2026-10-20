import {presentationView} from '../lib/presentationCopy'
import { ArrowLeft } from 'lucide-react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'
import '../styles/reader-navigation.css'

export interface ReaderNavigation { sections: VaultSection[]; onNavigate: (id: string) => void }
export function ChapterNavigation({ sections, current, onNavigate, onBack }: ReaderNavigation & { current: string; onBack: () => void }) {
  sections=presentationView(sections)
  return <aside className="chapter-navigation" aria-label="Reader contents">
    <button className="text-button chapter-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to Console</button>
    <nav className="chapter-list" aria-label="Investment chapters"><h2>Contents</h2><ol>{sections.map(section => <li key={section.id}><button aria-current={section.id === current ? 'page' : undefined} onClick={() => onNavigate(section.id)}><span>{sectionNumber(section.number)}</span><span>{section.title}</span></button></li>)}</ol></nav>
    <label className="chapter-selector">Contents<select aria-label="Investment chapter" value={current} onChange={event => onNavigate(event.target.value)}>{sections.map(section => <option key={section.id} value={section.id}>{sectionNumber(section.number)} / {section.title}</option>)}</select></label>
  </aside>
}
