import { ChevronRight, LockKeyhole, Volume2, VolumeX } from 'lucide-react'

export function VaultEntry({ onEnter, onSkip, onMute, muted, mode }: { onEnter: () => void; onSkip: () => void; onMute: () => void; muted: boolean; mode: 'secure' | 'demo' | 'local' | 'presentation' }) {
  return <main id="main-content" className="landing-main" aria-labelledby="landing-title">
    <div className="landing-identity" aria-hidden="true"><span>PRIVATE PRESENTATION</span><span>JONATHAN BLACKBURN / JB³</span></div>
    <nav className="landing-controls" aria-label="Introduction controls"><button className="landing-sound" onClick={onMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted} title="Original, quiet instrument sounds">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button className="landing-skip" onClick={onSkip}>Skip intro <ChevronRight size={12} /></button></nav>
    <section className="landing-copy">
      <div className="landing-block landing-block--1"><h1 id="landing-title" className="landing-title" tabIndex={-1}>JB³ Investment Vault</h1><p className="landing-text">This private investment presentation has been prepared exclusively for Bruce Blackburn.</p></div>
      <div className="landing-separator landing-block landing-block--2" aria-hidden="true" />
      <div className="landing-block landing-block--3"><p className="landing-text--secondary">All investment material is confidential.<br />Supporting evidence and financial schedules retain their recorded approval and verification status.</p><p className="landing-disclaimer">{mode === 'presentation' ? 'A temporary presentation for Bruce Blackburn. The PIN is an entry control, not secure authentication.' : mode === 'secure' ? 'An authorised account is required to access confidential content. This introduction does not grant access.' : mode === 'local' ? 'Prepared for a confidential conversation. Draft evidence and provisional figures remain clearly identified.' : 'Demonstration content only. No confidential materials are available in this mode.'}</p></div>
      <div className="landing-button-wrapper"><button className="landing-enter" onClick={onEnter}>Enter vault <LockKeyhole size={15} /></button></div>
    </section>
    <div className="landing-footer" aria-hidden="true"><span /><p>Private by intention.</p></div>
  </main>
}
