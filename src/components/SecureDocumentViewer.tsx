import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export default function SecureDocumentViewer({ source, title, onClose, expiresAt, accessLabel }: { source: string | Uint8Array; title: string; onClose: () => void; expiresAt?: number; accessLabel?: string }) {
  const [pages, setPages] = useState(0), [page, setPage] = useState(1), [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(600), [expired, setExpired] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const file = useMemo(() => typeof source === 'string' ? source : { data: source.slice() }, [source])
  useEffect(() => { if (!host.current) return; const observer = new ResizeObserver(entries => setWidth(Math.min(800, entries[0].contentRect.width))); observer.observe(host.current); return () => observer.disconnect() }, [])
  useEffect(() => { if (!expiresAt) return; const timer = window.setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now())); return () => window.clearTimeout(timer) }, [expiresAt])
  return <section className="document-viewer"><div className="viewer-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={16} />Back to library</button><span className="mono">{accessLabel ?? (expiresAt ? 'CONFIDENTIAL · SHORT-LIVED ACCESS' : 'SYNTHETIC DEMONSTRATION PDF')}</span></div><h2>{title}</h2>
    {expired ? <p role="status" className="empty-state">This viewing session has expired. Return to the library and open the document again.</p> : <><div className="pdf-controls"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">Page {page} of {pages || '…'}</span><button aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button><button aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(Math.max(.75, zoom - .25))}><ZoomOut size={18} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + .25))}><ZoomIn size={18} /></button></div>
    <div ref={host} className="pdf-host"><Document suspense={false} file={file} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={<p className="empty-state" role="status">Loading document…</p>} error={<p className="empty-state" role="alert">The document could not be opened. Access may have expired; return to the library and try again.</p>}><Page pageNumber={page} width={Math.max(240, width - 32) * zoom} renderAnnotationLayer={false} /></Document></div></>}
  </section>
}
