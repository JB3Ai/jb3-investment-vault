# View and route map

There is one document URL `/`. No React Router, file-based router, path routes or hash navigation exists. `src/App.tsx` owns the `View` union and state; refresh returns to initial mode, and navigation scrolls to the top. The full view-switch implementation is reproduced below.

| URL / state | Entry component | Shared layout | Content |
| --- | --- | --- | --- |
| `/`, entry | src/components/VaultEntry.tsx | App + LeatherBackground | Demonstration entry, emblem, explanatory disclosure, enter action |
| `/`, console | src/components/ConsoleFrame.tsx | App + LeatherBackground | Editorial heading, dual rotary selectors, OLED preview, eleven-section index |
| `/`, reader | src/components/SectionReader.tsx + src/components/SectionModules.tsx | App + LeatherBackground + SectionReader | Selected narrative, evidence/provenance, optional interactive module |
| `/`, documents | src/components/DocumentLibrary.tsx | App + LeatherBackground | Sample PDF or authorised library; lazy SecureDocumentViewer |
| `/`, briefing | src/components/ExecutiveBriefing.tsx | App + LeatherBackground | Approved current sections, print action, A4 print styling |
| `/`, secure unauthenticated | src/components/AuthPanel.tsx | App + LeatherBackground | Invitation-only sign-in / configuration failure |

Secure mode starts on console but the authentication, loading, error and no-approved-sections gates take precedence. Demonstration starts at entry. Preserve these gates; local-only design changes must not configure or bypass remote access.

Reader IDs: introduction, current-position, history-evidence, assets-claims, financial-requirements, beobacht-alignment, commercial-pipeline, southern-african-strategy, financial-forecast, investment-structures, closing.

Modules: history-evidence uses HistoricalTimeline and EvidenceGallery; commercial-pipeline uses OpportunityPipeline; financial-forecast and financial-requirements share FinancialDashboard; investment-structures uses InvestmentStructures. SectionModules renders these only for DEMONSTRATION content.

## View switch (full router-equivalent source)

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
