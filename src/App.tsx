import {ReadingRoom} from './components/ReadingRoom'
import {BuildReference} from './components/BuildReference'
import {presentationText} from './lib/presentationCopy'
import { lazy, Suspense, useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ArrowLeft, LogOut } from 'lucide-react'
import { LeatherBackground } from './components/LeatherBackground'
import { EntryExperience } from './components/EntryExperience'
import { ConsoleFrame } from './components/ConsoleFrame'
import { SectionReader } from './components/SectionReader'
import { AuthenticatedSectionReader } from './components/AuthenticatedSectionReader'
import { SectionModules } from './components/SectionModules'
import { Portfolio } from './components/Portfolio'
import { DocumentLibrary } from './components/DocumentLibrary'
import { ExecutiveBriefing } from './components/ExecutiveBriefing'
import { presentationSections } from './lib/presentationSections'
import { HiFiNavigation } from './components/HiFiNavigation'
import { secureMode, supabase } from './lib/supabase'
import { useVault } from './lib/useVault'

type View = 'console' | 'reader' | 'documents' | 'briefing' | 'portfolio' | 'reading-room'
const PrivateLocalVault = import.meta.env.DEV && import.meta.env.MODE === 'private-local' ? lazy(() => import('./components/PrivateLocalVault')) : null
const ReleasedPresentation = import.meta.env.VITE_VAULT_MODE === 'presentation' ? lazy(() => import('./components/PrivateLocalVault')) : null
export default function App() {
  return <EntryExperience mode={PrivateLocalVault ? 'local' : ReleasedPresentation ? 'presentation' : secureMode ? 'secure' : 'demo'}>{replay => PrivateLocalVault ? <Suspense fallback={<p role="status">Opening local owner review…</p>}><PrivateLocalVault onReplay={replay} /></Suspense> : ReleasedPresentation ? <Suspense fallback={<p role="status">Opening the presentation…</p>}><ReleasedPresentation onReplay={replay} /></Suspense> : <StandardVault onReplay={replay} />}</EntryExperience>
}
function StandardVault({ onReplay }: { onReplay: () => void }) {
  const vault = useVault()
  const [view, setView] = useState<View>('console')
  const [selected, setSelected] = useState('introduction')
  const presentationOnly = secureMode && (!vault.session || vault.loading || !!vault.error || !vault.sections.length)
  const sections = presentationOnly ? presentationSections : vault.sections
  const section = sections.find(s => s.id === selected) ?? sections[0]
  const next = sections[sections.findIndex(s => s.id === section?.id) + 1]
  const navigate = (destination: View) => { setView(destination); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const open = (id: string) => { setSelected(id); navigate('reader') }
  useEffect(() => { document.title = `${view === 'reader' && section ? `${presentationText(section.title)}: ` : ''}JB³ Private Investment Vault` }, [view, section])
  useEffect(() => { if (view === 'reader') document.querySelector<HTMLElement>('.reader h1')?.focus() }, [view, selected])
  const ready = !!section
  return <MotionConfig reducedMotion="user"><LeatherBackground><a className="skip-link" href="#main-content">Skip to content</a><div className="app-shell">
    <header className="site-header"><button className="brand" aria-label="JB³ vault home" onClick={() => navigate('console')}>JB<sup>3</sup></button><span className="brand-divider" /><span className="brand-title">PRIVATE INVESTMENT VAULT</span><span className="edition"><span className="status-light" />{secureMode ? <><span>{vault.tier ? vault.tier + ' access' : 'Private presentation'}</span>{vault.session && <button className="signout" aria-label="Sign out" onClick={() => { void vault.signOut(); navigate('console') }}><LogOut size={17} /></button>}</> : 'Demonstration edition'}</span></header>
    {ready && <HiFiNavigation onReadingRoom={()=>navigate('reading-room')} active={view === 'reader' && selected === 'financial-requirements' ? 'finances' : view} onDocuments={() => navigate('documents')} onFinances={() => open('financial-requirements')} onBriefing={() => navigate('briefing')} onPortfolio={() => navigate('portfolio')} />}
    {!section ? <main id="main-content" className="entry"><h1>A considered pause.</h1><p>No approved sections are available for this account.</p></main>
      : view==='reading-room'?<ReadingRoom sections={sections} selected={selected} onOpen={open} onLaboratory={()=>open('history-evidence')} onBack={()=>navigate('console')}/>: view === 'console' ? <ConsoleFrame sections={sections} selected={section} onSelect={setSelected} onOpen={open} />
      : view === 'reader' ? presentationOnly
        ? <SectionReader section={section} navigation={{ sections, onNavigate: open }} onBack={() => navigate('console')} onNext={next ? () => open(next.id) : undefined}><section><h2>{selected === 'financial-requirements' ? 'Financial Schedules' : 'Private presentation'}</h2><p role="status" className="notice">{selected === 'financial-requirements' || selected === 'financial-forecast' ? 'Financial information access pending.' : 'Narrative access pending.'}</p><p>Protected material remains subject to its existing permissions.</p></section></SectionReader>
        : secureMode ? <AuthenticatedSectionReader key={(vault.session?.user.id ?? '') + ':' + section.id} client={supabase} accountId={vault.session?.user.id} section={section} navigation={{ sections, onNavigate: open }} onBack={() => navigate('console')} onNext={next ? () => open(next.id) : undefined} />
        : <SectionReader section={section} navigation={{ sections, onNavigate: open }} onBack={() => navigate('console')} onNext={next ? () => open(next.id) : undefined}><SectionModules key={section.id} section={section} /></SectionReader>
      : view === 'portfolio' ? <Portfolio key={vault.session?.user.id ?? 'presentation'} presentationOnly={presentationOnly} onBack={() => navigate('console')} />
      : view === 'documents' ? <DocumentLibrary key={vault.session?.user.id ?? 'presentation'} presentationOnly={presentationOnly} onBack={() => navigate('console')} />
      : presentationOnly ? <main id="main-content" className="reader executive-briefing"><button className="text-button" onClick={() => navigate('console')}><ArrowLeft size={16} />Back to Console</button><header className="reader-heading"><h1>Executive briefing.</h1></header><p role="status" className="notice">Private briefing access pending.</p></main>
      : <ExecutiveBriefing sections={sections} onBack={() => navigate('console')} />}

    <footer className="site-footer"><span className="footer-brand">JB<sup>3</sup></span><span>/ Jonathan Blackburn</span><span className="footer-rule" /><span>Private by intention.</span><BuildReference/><button className="footer-exit" onClick={onReplay} aria-label="Replay introduction" title="Replay introduction"><ArrowLeft size={16} /></button></footer>
  </div></LeatherBackground></MotionConfig>
}
