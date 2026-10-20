import {presentationView} from '../lib/presentationCopy'
import type { VaultSection } from '../types'
import { AnalogKnob } from './AnalogKnob'
import { OLEDPanel } from './OLEDPanel'
import { SectionIndex } from './SectionIndex'

export function ConsoleFrame({ sections, selected, onSelect, onOpen }: { sections: VaultSection[]; selected: VaultSection; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  sections=presentationView(sections);selected=presentationView(selected)
  return <main id="main-content" className="console-page console-asymmetrical">
    <div className="console-heading"><h1>Conviction, made tangible.</h1><p>The context. The evidence. The opportunity.</p></div>
    <section className="console-frame" aria-label="Investment vault console">
      {['tl', 'tr', 'bl', 'br'].map(position => <span key={position} className={`screw screw-${position}`} aria-hidden="true" />)}
      <div className="console-controls"><AnalogKnob label="Context" sections={sections.filter(s => s.number <= 4)} selected={selected.id} onSelect={onSelect} /><OLEDPanel section={selected} onOpen={() => onOpen(selected.id)} /><AnalogKnob label="Future" sections={sections.filter(s => s.number > 4)} selected={selected.id} onSelect={onSelect} /></div>
      <div className="console-engraving"><span>JB³ <i>/</i> PRIVATE INVESTMENT VAULT</span><span>TURN TO EXPLORE <i>·</i> SELECT TO READ</span><span>SERIES 01</span></div>
    </section>
    <SectionIndex sections={sections} selected={selected.id} onSelect={onSelect} onOpen={onOpen} />
  </main>
}
