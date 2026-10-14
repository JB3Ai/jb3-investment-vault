import { ArrowRight, LockKeyhole } from 'lucide-react'
import { motion } from 'motion/react'

export function VaultEntry({ onEnter }: { onEnter: () => void }) {
  return <motion.main className="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .7 }}>
    <div className="entry-emblem" aria-hidden="true"><span>JB<sup>3</sup></span></div>
    <h1>Private by intention.<br /><em>Considered by design.</em></h1>
    <p>A private investment presentation for Jonathan Blackburn,<br className="desktop-break" /> JB³ and the proposed strategic relationship with Beobacht.</p>
    <button className="primary-button" onClick={onEnter}>Explore the demonstration <ArrowRight size={18} /></button>
    <div className="entry-disclosure"><LockKeyhole size={14} /><span>Demonstration content only. No confidential materials.</span></div>
    <p className="entry-note">The context. The evidence. The opportunity.</p>
  </motion.main>
}
