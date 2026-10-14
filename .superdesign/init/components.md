# Shared UI components

React 19.3 + TypeScript, Vite 8.3. Custom native HTML controls, Lucide icons, Motion, react-pdf. No shadcn, Radix, MUI or general Button/Card primitives. Reused button, input, table, notice and metadata patterns are CSS classes in src/styles.css. Layout components are copied in layouts.md; feature-only modules are traced in pages.md.

## AnalogKnob
Accessible mechanical section selector; selected ID, sections, label and onSelect callback.

### `src/components/AnalogKnob.tsx`

```tsx
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'

interface Props { label: string; sections: VaultSection[]; selected: string; onSelect: (id: string) => void }
export function AnalogKnob({ label, sections, selected, onSelect }: Props) {
  const last = useRef(0)
  if (sections.length === 0) return <div className="knob-empty">No approved {label.toLowerCase()} sections.</div>
  const index = Math.max(0, sections.findIndex(section => section.id === selected))
  const active = sections.some(section => section.id === selected)
  const select = (next: number) => onSelect(sections[Math.max(0, Math.min(sections.length - 1, next))].id)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, Home: 0, End: sections.length - 1 }
    if (event.key in moves) { event.preventDefault(); select(moves[event.key]) }
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); last.current = event.clientX - event.clientY }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = event.clientX - event.clientY - last.current
    if (Math.abs(delta) >= 24) { select(index + Math.sign(delta)); last.current = event.clientX - event.clientY }
  }
  return <div className={`knob-group ${active ? 'is-active' : ''}`}>
    <h2>{label}</h2>
    <div className="dial-surround">
      <svg className="dial-scale" viewBox="0 0 240 240" aria-hidden="true">
        {Array.from({ length: 37 }, (_, i) => {
          const angle = (-225 + i * 7.5) * Math.PI / 180
          return <line key={i} x1={120 + Math.cos(angle) * 105} y1={120 + Math.sin(angle) * 105} x2={120 + Math.cos(angle) * (i % 6 === 0 ? 115 : 110)} y2={120 + Math.sin(angle) * (i % 6 === 0 ? 115 : 110)} />
        })}
      </svg>
      <div className="knob" role="slider" tabIndex={0} aria-label={`${label} section`} aria-valuemin={sections[0].number} aria-valuemax={sections.at(-1)!.number} aria-valuenow={sections[index].number} aria-valuetext={`${sections[index].title}${active ? ', selected' : ', turn to select'}`} aria-describedby={`${label}-help`} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
        <div className="knob-face"><div className="knob-pointer" style={{ transform: `rotate(${-135 + (index / Math.max(1, sections.length - 1)) * 270}deg)` }}><span /></div><span className="knob-center" /></div>
      </div>
      <span className="dial-min">{sectionNumber(sections[0].number)}</span><span className="dial-max">{sectionNumber(sections.at(-1)!.number)}</span>
    </div>
    <div className="knob-stepper"><button aria-label={`Previous ${label.toLowerCase()} section`} disabled={active && index === 0} onClick={() => select(active ? index - 1 : 0)}><ChevronLeft size={15} /></button><span>{sectionNumber(sections[index].number)} / {sectionNumber(sections.at(-1)!.number)}</span><button aria-label={`Next ${label.toLowerCase()} section`} disabled={active && index === sections.length - 1} onClick={() => select(active ? index + 1 : 0)}><ChevronRight size={15} /></button></div>
    <span className="sr-only" id={`${label}-help`}>Drag up or right to advance. Use arrow keys, Home or End, or the previous and next buttons.</span>
  </div>
}
```

## OLEDPanel
Animated section preview; section and onOpen callback.

### `src/components/OLEDPanel.tsx`

```tsx
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
```

## EvidenceGallery
Reusable image/empty-evidence carousel; images array.

### `src/components/EvidenceGallery.tsx`

```tsx
import { useState } from 'react'
import { ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'
import type { VaultImage } from '../types'
export function EvidenceGallery({ images }: { images: VaultImage[] }) {
  const [index, setIndex] = useState(0)
  const current = images[index]
  if (!current) return <p className="empty-state">No approved images available.</p>
  return <section className="content-module"><div className="module-heading"><h2>COVID laboratory case study</h2><span className="metadata">EVIDENCE PENDING</span></div><p className="module-note">Photographs and case-study facts must be supplied and verified before publication.</p>
    <figure className="gallery-figure">{current.url ? <img src={current.url} alt={current.alt} /> : <div className="gallery-empty"><ImageOff size={34} strokeWidth={1} /><span>Photograph not yet supplied</span><small>No illustrative photograph is presented as evidence.</small></div>}<figcaption aria-live="polite"><span>{current.caption}</span><span className="mono">{index + 1} / {images.length}</span></figcaption></figure>
    <div className="gallery-controls"><button className="text-button" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16} />Previous image</button><button className="text-button" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)}>Next image<ChevronRight size={16} /></button></div>
  </section>
}
```

## SecureDocumentViewer
PDF page/zoom controls with expiry; source, title, onClose and optional expiresAt.

### `src/components/SecureDocumentViewer.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function SecureDocumentViewer({ source, title, onClose, expiresAt }: { source: string | Uint8Array; title: string; onClose: () => void; expiresAt?: number }) {
  const [pages, setPages] = useState(0), [page, setPage] = useState(1), [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(600), [expired, setExpired] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const file = useMemo(() => typeof source === 'string' ? source : { data: source.slice() }, [source])
  useEffect(() => { if (!host.current) return; const observer = new ResizeObserver(entries => setWidth(Math.min(800, entries[0].contentRect.width))); observer.observe(host.current); return () => observer.disconnect() }, [])
  useEffect(() => { if (!expiresAt) return; const timer = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now())); return () => window.clearTimeout(timer) }, [expiresAt])
  return <section className="document-viewer"><div className="viewer-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={16} />Back to library</button><span className="mono">{expiresAt ? 'CONFIDENTIAL · SHORT-LIVED ACCESS' : 'SYNTHETIC DEMONSTRATION PDF'}</span></div><h2>{title}</h2>
    {expired ? <p role="status" className="empty-state">This viewing session has expired. Return to the library and open the document again.</p> : <><div className="pdf-controls"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">Page {page} of {pages || '…'}</span><button aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button><button aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(Math.max(.75, zoom - .25))}><ZoomOut size={18} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + .25))}><ZoomIn size={18} /></button></div>
    <div ref={host} className="pdf-host"><Document suspense={false} file={file} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={<p className="empty-state" role="status">Loading document…</p>} error={<p className="empty-state" role="alert">The document could not be opened. Access may have expired; return to the library and try again.</p>}><Page pageNumber={page} width={Math.max(240, width - 32) * zoom} renderAnnotationLayer={false} /></Document></div></>}
  </section>
}
```

## ErrorBoundary
Root render error fallback; children.

### `src/components/ErrorBoundary.tsx`

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Do not log document content or access tokens. */ }
  render() { return this.state.failed ? <main className="app-error"><h1>The vault could not be displayed.</h1><p>Please reload to try again. If the problem continues, contact the vault owner.</p><button className="primary-button" onClick={() => location.reload()}>Reload vault</button></main> : this.props.children }
}
```
