# Shared layouts

All application views share App.tsx. Header, utility navigation and footer are inline and have no separate source files. No sidebar, breadcrumb or independent theme provider exists.

React root and ErrorBoundary bootstrap; imports global styles.

### `src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>)
```

Shared leather-backed shell, brand header, utility links, footer and view/security orchestration.

### `src/App.tsx`

```tsx
import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ArrowLeft, Files, Printer, LogOut } from 'lucide-react'
import { LeatherBackground } from './components/LeatherBackground'
import { VaultEntry } from './components/VaultEntry'
import { ConsoleFrame } from './components/ConsoleFrame'
import { SectionReader } from './components/SectionReader'
import { SectionModules } from './components/SectionModules'
import { DocumentLibrary } from './components/DocumentLibrary'
import { ExecutiveBriefing } from './components/ExecutiveBriefing'
import { AuthPanel } from './components/AuthPanel'
import { secureMode } from './lib/supabase'
import { useVault } from './lib/useVault'

type View = 'entry' | 'console' | 'reader' | 'documents' | 'briefing'
export default function App() {
  const vault = useVault()
  const [view, setView] = useState<View>(secureMode ? 'console' : 'entry')
  const [selected, setSelected] = useState('introduction')
  const section = vault.sections.find(s => s.id === selected) ?? vault.sections[0]
  const next = vault.sections[vault.sections.findIndex(s => s.id === section?.id) + 1]
  const navigate = (destination: View) => { setView(destination); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const open = (id: string) => { setSelected(id); navigate('reader') }
  useEffect(() => { document.title = `${view === 'reader' && section ? `${section.title} — ` : ''}JB³ Private Investment Vault` }, [view, section])
  useEffect(() => { if (view === 'reader') document.querySelector<HTMLElement>('.reader h1')?.focus() }, [view, selected])
  const ready = !secureMode || !!vault.session && !vault.loading && !vault.error && !!section
  return <MotionConfig reducedMotion="user"><LeatherBackground><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell">
    <header className="site-header"><button className="brand" aria-label="JB³ vault home" onClick={() => navigate(secureMode ? 'console' : 'entry')}>JB<sup>3</sup></button><span className="brand-divider" /><span className="brand-title">PRIVATE INVESTMENT VAULT</span><span className="edition"><span className="status-light" />{secureMode ? vault.tier ? vault.tier + ' access' : 'Invitation only' : 'Demonstration edition'}</span>{secureMode && vault.session && <button className="signout" aria-label="Sign out" onClick={() => { void vault.signOut(); navigate('console') }}><LogOut size={17} /></button>}</header>
    {ready && view !== 'entry' && <nav className="utility-nav" aria-label="Vault tools"><button onClick={() => navigate('documents')}><Files size={14} />Documents</button><button onClick={() => navigate('briefing')}><Printer size={14} />Executive briefing</button></nav>}
    {secureMode && !vault.session ? <AuthPanel /> : vault.loading ? <main id="main-content" className="entry"><p role="status">Checking your vault access…</p></main> : vault.error ? <main id="main-content" className="entry"><h1>Access unavailable.</h1><p role="alert">{vault.error}</p><button className="primary-button" onClick={vault.retry}>Retry access check</button></main> : !section ? <main id="main-content" className="entry"><h1>A considered pause.</h1><p>No approved sections are available for this account.</p></main> : view === 'entry' ? <div id="main-content"><VaultEntry onEnter={() => navigate('console')} /></div> : view === 'console' ? <ConsoleFrame sections={vault.sections} selected={section} onSelect={setSelected} onOpen={open} /> : view === 'reader' ? <SectionReader section={section} onBack={() => navigate('console')} onNext={next ? () => open(next.id) : undefined}><SectionModules key={section.id} section={section} /></SectionReader> : view === 'documents' ? <DocumentLibrary key={vault.session?.user.id ?? 'demo'} onBack={() => navigate('console')} /> : <ExecutiveBriefing sections={vault.sections} onBack={() => navigate('console')} />}
    <footer className="site-footer"><span className="footer-brand">JB<sup>3</sup></span><span>/ Jonathan Blackburn</span><span className="footer-rule" /><span>Private by intention.</span>{!secureMode && view !== 'entry' && <button className="footer-exit" onClick={() => navigate('entry')} aria-label="Return to entry"><ArrowLeft size={16} /></button>}</footer>
  </div></LeatherBackground></MotionConfig>
}
```

Full-height textured background and decorative grain.

### `src/components/LeatherBackground.tsx`

```tsx
import type { ReactNode } from 'react'

export function LeatherBackground({ children }: { children: ReactNode }) {
  return <div className="leather-background"><div className="leather-grain" aria-hidden="true" />{children}</div>
}
```

Instrument chassis and Context/Future selectors around OLED; section index below.

### `src/components/ConsoleFrame.tsx`

```tsx
import type { VaultSection } from '../types'
import { AnalogKnob } from './AnalogKnob'
import { OLEDPanel } from './OLEDPanel'
import { SectionIndex } from './SectionIndex'

export function ConsoleFrame({ sections, selected, onSelect, onOpen }: { sections: VaultSection[]; selected: VaultSection; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  return <main id="main-content" className="console-page">
    <div className="console-heading"><h1>Conviction, made tangible.</h1><p>The context. The evidence. The opportunity.</p></div>
    <section className="console-frame" aria-label="Investment vault console">
      {['tl', 'tr', 'bl', 'br'].map(position => <span key={position} className={`screw screw-${position}`} aria-hidden="true" />)}
      <div className="console-controls"><AnalogKnob label="Context" sections={sections.filter(s => s.number <= 4)} selected={selected.id} onSelect={onSelect} /><OLEDPanel section={selected} onOpen={() => onOpen(selected.id)} /><AnalogKnob label="Future" sections={sections.filter(s => s.number > 4)} selected={selected.id} onSelect={onSelect} /></div>
      <div className="console-engraving"><span>JB³ <i>/</i> PRIVATE INVESTMENT VAULT</span><span>TURN TO EXPLORE <i>·</i> SELECT TO READ</span><span>SERIES 01</span></div>
    </section>
    <SectionIndex sections={sections} selected={selected.id} onSelect={onSelect} onOpen={onOpen} />
  </main>
}
```

Two-group navigation shared by all console selections.

### `src/components/SectionIndex.tsx`

```tsx
import { ArrowUpRight } from 'lucide-react'
import { sectionNumber } from '../content/registry'
import type { VaultSection } from '../types'

export function SectionIndex({ sections, selected, onSelect, onOpen }: { sections: VaultSection[]; selected: string; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  return <nav className="section-index" aria-label="Section index">{[{ title: 'Context', items: sections.filter(s => s.number <= 4) }, { title: 'Future', items: sections.filter(s => s.number > 4) }].map(group => <div className="index-group" key={group.title}><h2>{group.title}<span>{group.title === 'Context' ? '01 — 04' : '05 — 11'}</span></h2><ol>{group.items.map(s => <li key={s.id} className={selected === s.id ? 'selected' : ''}><button aria-current={selected === s.id ? 'true' : undefined} onClick={() => onSelect(s.id)}><span>{sectionNumber(s.number)}</span>{s.title}</button><button className="index-open" aria-label={`Open ${s.title}`} onClick={() => onOpen(s.id)}><ArrowUpRight size={16} /></button></li>)}</ol></div>)}</nav>
}
```

Shared narrative reader, evidence sidebar and next/back navigation for eleven sections.

### `src/components/SectionReader.tsx`

```tsx
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
```
