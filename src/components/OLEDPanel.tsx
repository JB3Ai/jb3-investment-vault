import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'

export function OLEDPanel({ section, onOpen }: { section: VaultSection; onOpen: () => void }) {
  return <div className="oled-bezel"><div className="oled-panel">
    <motion.div key={section.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="oled-content">
      <div className="oled-top"><span><b>{sectionNumber(section.number)}</b> / {section.title}</span><span className="signal-line" aria-hidden="true" /></div>
      <div aria-live="polite" aria-atomic="true"><h2>{section.subtitle}</h2><p>{section.overview}</p></div>
      <button className="oled-open" onClick={onOpen}>Open section <ArrowUpRight size={19} /></button>
    </motion.div>
    <div className="oled-status"><span className="status-light" />{section.verification === 'DEMONSTRATION' ? 'DEMONSTRATION CONTENT · NOT VERIFIED' : `${section.disclosure} · ${section.verification}`}</div>
  </div></div>
}
