import {useState} from 'react'
import {ExternalLink,Play} from 'lucide-react'
import {youtubeId,type LaboratoryEvidenceReview} from '../lib/laboratoryEvidence'
import '../styles/laboratory-evidence.css'

function YouTubeThumbnail({id}:{id:string}){
 const [attempt,setAttempt]=useState(0)
 const unavailable=()=>setAttempt(current=>Math.min(2,current+1))
 return <span className="video-evidence-frame video-thumbnail-frame">{attempt<2?<img src={`https://i.ytimg.com/vi/${id}/${attempt===0?'maxresdefault':'hqdefault'}.jpg`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={unavailable} onLoad={event=>{if(event.currentTarget.naturalWidth<320)unavailable()}}/>:<span className="video-thumbnail-fallback"><span>Preview unavailable</span><small>The original video can still be opened on YouTube.</small></span>}<span className="video-thumbnail-play" aria-hidden="true"><Play size={26} strokeWidth={1.5}/></span></span>
}

export function OriginalVideoEvidence({videos}:{videos:LaboratoryEvidenceReview['videos']}){
 const entries=videos.flatMap((video,index)=>{const id=youtubeId(video.url);return id&&video.classification==='BRUCE_PRIVATE'&&video.approval==='draft'&&video.verification==='awaiting-verification'?[{video,index,id}]:[]})
 if(!entries.length)return null
 return <section className="content-module original-video-evidence" aria-label="Original Video Evidence"><div className="module-heading"><h2>Original Video Evidence</h2><span className="metadata">BRUCE_PRIVATE / DRAFT</span></div><p className="module-note">Founder-provided links awaiting verification. Titles, recording dates and certification have not been verified. Preview images load from YouTube; videos open on YouTube in a new tab.</p><div className="video-evidence-grid">{entries.map(({video,index,id})=>{const title=video.title??`Original video ${index+1}`;return <article key={video.id} data-video-record={video.id}><a className="video-evidence-link" href={video.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`${title}: Watch on YouTube (opens in a new tab)`}><YouTubeThumbnail key={id} id={id}/><div className="video-evidence-caption"><h3 className="video-evidence-title">{title}</h3><span className="video-evidence-watch">Watch on YouTube<ExternalLink size={13} aria-hidden="true"/></span></div></a><details><summary>Source &amp; verification notes</summary><p>{video.sourceReference}</p><p>{video.url}</p><p>Classification: {video.classification}. Approval: {video.approval}. Verification: {video.verification}. Dates and certification remain unknown.</p></details></article>})}</div></section>
}
