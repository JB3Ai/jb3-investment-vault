import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import { youtubeId, type LaboratoryEvidenceReview } from '../lib/laboratoryEvidence'
import '../styles/laboratory-evidence.css'

export function OriginalVideoEvidence({ videos }: { videos: LaboratoryEvidenceReview['videos'] }) {
  const [loaded, setLoaded] = useState<string[]>([])
  if (!videos.length) return null
  return <section className="content-module original-video-evidence" aria-label="Original Video Evidence"><div className="module-heading"><h2>Original Video Evidence</h2><span className="metadata">BRUCE_PRIVATE / DRAFT</span></div><p className="module-note">Founder-provided links awaiting verification. Titles, recording dates and certification have not been verified. No YouTube connection is made until you load a video or open its external link.</p><div className="video-evidence-grid">{videos.map((video, index) => {
    const id = youtubeId(video.url)
    if (!id || video.classification !== 'BRUCE_PRIVATE' || video.approval !== 'draft' || video.verification !== 'awaiting-verification') return null
    const active = loaded.includes(video.id)
    return <article key={video.id}><h3>Original video {index + 1}</h3><div className="video-evidence-frame">{active ? <iframe title={`Original video evidence ${index + 1}`} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`} referrerPolicy="no-referrer" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <button className="video-load" onClick={() => setLoaded(current => [...current, video.id])}><Play size={26} aria-hidden="true" /><span>Load original video {index + 1}</span><small>Connect to YouTube · playback will not start automatically</small></button>}</div><div className="video-evidence-actions"><a href={video.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open on YouTube<ExternalLink size={13} aria-hidden="true" /></a>{active && <button onClick={() => setLoaded(current => current.filter(value => value !== video.id))}>Unload video {index + 1}</button>}</div><details><summary>Source &amp; verification notes</summary><p>{video.sourceReference}</p><p>{video.url}</p><p>Classification: {video.classification}. Approval: {video.approval}. Verification: {video.verification}. Dates and certification remain unknown.</p></details></article>
  })}</div></section>
}
