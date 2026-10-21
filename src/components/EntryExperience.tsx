import {BuildReference} from './BuildReference'
import { lazy,Suspense,useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { VaultEntry } from './VaultEntry'
import { ConsoleFrame } from './ConsoleFrame'
import { LeatherBackground } from './LeatherBackground'
import { demoSections } from '../content/registry'
import { audioManager, type AudioCue } from '../lib/audioManager'
import { bootCalibration, calibrationDuration, calibrationReturn, landingSessionKey, landingTiming, rememberFlag, initialEntryPhase } from '../lib/landingState'
import '../styles/landing.css'

const PresentationPin = lazy(() => import('./PresentationPin').then(module => ({ default: module.PresentationPin })))

type Phase = 'landing' | 'init' | 'powerup' | 'ready'
// Decorative shell only: no private content or authentication work during the intro.
const bootSections = demoSections.map(section => ({ ...section, subtitle: 'A considered beginning.', overview: '', narrative: [], evidence: [], images: [], documents: [], verification: 'PENDING' as const, disclosure: 'PRIVATE' as const }))

export function EntryExperience({ children, mode }: { children: (replay: () => void) => ReactNode; mode: 'secure' | 'demo' | 'local' | 'presentation' }) {
  const [phase, setPhase] = useState<Phase>(() => initialEntryPhase(mode))
  const [muted, setMuted] = useState(() => audioManager.isMuted())
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [revision, setRevision] = useState(0)
  const [pinRequest,setPinRequest]=useState<{skip:boolean}|null>(null)
  const entryButton=useRef<HTMLElement|null>(null)
  const phaseRef = useRef(phase), started = useRef(performance.now()), unlocked = useRef(false)
  const phaseVersion = useRef(0)
  const audioReady = useRef<Promise<boolean>>(Promise.resolve(false))
  phaseRef.current = phase
  const timing = landingTiming(viewport, reduced)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const resize = () => setViewport(window.innerWidth), motion = () => setReduced(query.matches)
    window.addEventListener('resize', resize); query.addEventListener('change', motion)
    const stop = () => { if (document.hidden) audioManager.stopAll() }
    document.addEventListener('visibilitychange', stop)
    return () => { phaseVersion.current++; window.removeEventListener('resize', resize); query.removeEventListener('change', motion); document.removeEventListener('visibilitychange', stop); audioManager.stopAll() }
  }, [])
  useEffect(() => {
    const version = ++phaseVersion.current
    started.current = performance.now()
    audioManager.stopAll()
    if (phase === 'landing') { started.current = performance.now(); unlocked.current = false; document.querySelector<HTMLElement>('#landing-title')?.focus(); return }
    if (phase === 'ready') {
      const heading = document.querySelector<HTMLElement>('h1')
      if (heading) { heading.tabIndex = -1; heading.focus() }
      return
    }
    if (reduced) { rememberFlag(landingSessionKey, true); setPhase('ready'); return }
    void audioReady.current.then(ready => {
      if (!ready || version !== phaseVersion.current || document.hidden) return
      if (phase === 'powerup') {
        void audioManager.playSound('power-hum', 0, -28, timing.powerup / 1000)
        const rise = bootCalibration.start / 1000
        const peak = (bootCalibration.start + bootCalibration.rise) / 1000
        const returning = (bootCalibration.start + bootCalibration.rise + bootCalibration.hold) / 1000
        void audioManager.playSound('whir-engage', rise, -32, (bootCalibration.rise + bootCalibration.stagger) / 1000)
        void audioManager.playSound('mechanism-click', peak, -30)
        void audioManager.playSound('mechanism-click', peak + bootCalibration.stagger / 1000, -33)
        void audioManager.playSound('whir-engage', returning, -35, (bootCalibration.fall + bootCalibration.stagger) / 1000)
        void audioManager.playSound('confirmation-chime', calibrationReturn / 1000, -28)
      } else {
        void audioManager.playSound('ambient-pad', 0, -27, timing.init / 1000)
        void audioManager.playSound('mechanism-click', 0, -20)
        void audioManager.playSound('shutter-whoosh', .08, -25)
      }
    })
    const timer = window.setTimeout(() => {
      if (version !== phaseVersion.current) return
      if (phase === 'init') setPhase('powerup')
      else { rememberFlag(landingSessionKey, true); setPhase('ready') }
    }, phase === 'init' ? timing.init : timing.powerup)
    return () => { window.clearTimeout(timer); audioManager.stopAll() }
  }, [phase, revision, reduced, timing.init, timing.powerup])

  function unlockAudio() {
    if (unlocked.current || reduced || phaseRef.current !== 'landing') return
    unlocked.current = true
    const version = phaseVersion.current
    audioReady.current = audioManager.init()
    void audioReady.current.then(ready => {
      if (!ready || version !== phaseVersion.current || phaseRef.current !== 'landing' || audioManager.isMuted()) return
      const elapsed = (performance.now() - started.current) / 1000
      if (elapsed < timing.landing) void audioManager.playSound('ambient-pad', 0, -27, timing.landing - elapsed)
      const cues: [AudioCue, number][] = [['shutter-whoosh', -25], ['mechanism-click', -20], ['whir-engage', -26], ['confirmation-chime', -24]]
      cues.forEach(([cue, db], index) => { if (timing.reveals[index] > elapsed) void audioManager.playSound(cue, timing.reveals[index] - elapsed, db) })
    })
  }
  function toggleMute() {
    const next = !audioManager.isMuted()
    audioManager.setMuted(next); setMuted(next)
    if (!next) {
      if (phaseRef.current === 'landing') { unlocked.current = false; unlockAudio() }
      else if (phaseRef.current === 'init' || phaseRef.current === 'powerup') {
        const activePhase = phaseRef.current, version = phaseVersion.current
        audioReady.current = audioManager.init()
        void audioReady.current.then(ready => {
          const remaining = (activePhase === 'init' ? timing.init : timing.powerup) / 1000 - (performance.now() - started.current) / 1000
          if (ready && version === phaseVersion.current && !document.hidden && remaining > .03) void audioManager.playSound(activePhase === 'init' ? 'ambient-pad' : 'power-hum', 0, -28, remaining)
        })
      }
    }
  }
  function requestEntry(skip:boolean){if(mode==='demo'){enter(skip);return}entryButton.current=document.activeElement as HTMLElement;audioManager.stopAll();setPinRequest({skip})}
  function closePin(){setPinRequest(null);requestAnimationFrame(()=>entryButton.current?.focus())}
  function enter(skip: boolean) {
    if (phaseRef.current !== 'landing') return
    if (skip || reduced) { finishIntro(); return }
    // User-gesture unlock is independent of network/decode success and never blocks entry.
    audioReady.current = audioManager.init()
    phaseRef.current = 'init'
    audioManager.stopAll(); setPhase('init')
  }
  function finishIntro() {
    phaseVersion.current++; phaseRef.current = 'ready'
    rememberFlag(landingSessionKey, true); audioManager.stopAll(); setPhase('ready')
  }
  const replay = () => { setPinRequest(null); audioManager.stopAll(); setRevision(value => value + 1); setPhase('landing'); window.scrollTo({ top: 0, behavior: 'instant' }) }
  if (phase === 'ready') return children(replay)
  const variables = { '--t-block-1': `${timing.reveals[0]}s`, '--t-block-2': `${timing.reveals[1]}s`, '--t-block-3': `${timing.reveals[2]}s`, '--t-button': `${timing.reveals[3]}s`, '--dur-reveal': `${timing.reveal}s`, '--init-duration': `${timing.init / 1000}s`, '--boot-duration': `${timing.powerup / 1000}s`, '--dial-duration': `${calibrationDuration}ms`, '--dial-delay': `${bootCalibration.start}ms`, '--dial-stagger': `${bootCalibration.stagger}ms`, '--dial-peak': `${bootCalibration.travelDegrees * bootCalibration.peakFraction}deg`, '--oled-ready': `${calibrationReturn}ms` } as CSSProperties
  return <><div key={revision} inert={pinRequest?true:undefined} className={`vault-landing vault-landing--${phase}`} style={variables} onPointerDownCapture={unlockAudio} onKeyDownCapture={event => { if (['Enter', ' '].includes(event.key)) unlockAudio() }}><a className="skip-link" href="#main-content">Skip to content</a>
    {phase === 'landing' ? <VaultEntry mode={mode} muted={muted} onMute={toggleMute} onEnter={() => requestEntry(false)} onSkip={() => requestEntry(true)} /> : <><div className="landing-controls"><button className="landing-sound" onClick={toggleMute} aria-label={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button className="landing-skip" onClick={finishIntro}>Skip intro</button></div><p className="sr-only" role="status">{phase === 'init' ? 'Preparing the Vault presentation.' : 'Preparing the console. Access permissions will be checked separately.'}</p>{phase === 'init' ? <main id="main-content" className="landing-initialisation"><span className="landing-title">JB³ PRIVATE INVESTMENT VAULT</span><h1>One considered conversation.</h1><p>Preparing the presentation</p><span className="landing-progress" aria-hidden="true" /></main> : <div className="landing-boot" aria-hidden="true" inert><LeatherBackground><div className="app-shell"><ConsoleFrame sections={bootSections} selected={bootSections[0]} onSelect={() => {}} onOpen={() => {}} /></div></LeatherBackground></div>}</>}
    {phase!=='landing'&&<footer className="intro-build"><BuildReference/></footer>}
  </div>{pinRequest&&<Suspense fallback={<p role="status">Preparing PIN entry...</p>}><PresentationPin onBack={closePin} onInteract={()=>{audioReady.current=audioManager.init()}} onSuccess={()=>{const skip=pinRequest.skip;setPinRequest(null);enter(skip)}}/></Suspense>}</>
}
