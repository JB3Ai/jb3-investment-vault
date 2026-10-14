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
