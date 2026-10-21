import {useEffect,useRef,useState} from 'react'
import {FileText} from 'lucide-react'
import {loadPrivateThumbnail,type LocalReview} from '../lib/localReview'
export type CoverPreview=NonNullable<LocalReview['thumbnailPreviews']>[number]
export function EvidencePreview({thumbnail,title,defer=false}:{thumbnail?:CoverPreview;title:string;defer?:boolean}){
 const [source,setSource]=useState(''),[failed,setFailed]=useState(false)
 const host=useRef<HTMLElement>(null),[visible,setVisible]=useState(!defer)
 useEffect(()=>{if(!defer){setVisible(true);return}const element=host.current;if(!element)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'240px'});observer.observe(element);return()=>observer.disconnect()},[defer])
 useEffect(()=>{setSource('');setFailed(false);if(!visible||!thumbnail?.available)return;const controller=new AbortController();let url='';void loadPrivateThumbnail(thumbnail.recordId,controller.signal).then(blob=>{controller.signal.throwIfAborted();url=URL.createObjectURL(blob);setSource(url)}).catch(()=>{if(!controller.signal.aborted)setFailed(true)});return()=>{controller.abort();if(url)URL.revokeObjectURL(url)}},[visible,thumbnail?.recordId,thumbnail?.available,thumbnail?.sha256])
 const neutral=thumbnail?.previewKind==='neutral',withheld=thumbnail?.originalAvailable===false
 return <figure ref={host} className="evidence-preview" data-thumbnail-record={thumbnail?.recordId} data-preview-kind={neutral?'neutral':'source-cover'}>{source?<img src={source} alt={`${neutral?'Neutral catalogue cover':'Document cover'}: ${title}`} onError={()=>{setSource('');setFailed(true)}}/>:<div className="evidence-cover-fallback" role="img" aria-label={`Catalogue cover: ${title}`}><FileText size={30} strokeWidth={1} aria-hidden="true"/><strong>{title}</strong><span>{failed?'Preview unavailable':thumbnail?.available?'Loading cover...':'Catalogue preview'}</span></div>}<figcaption>{neutral?withheld?'Neutral cover / original unpublished':'Neutral catalogue cover':'Document cover / draft evidence'}<span aria-hidden="true"/></figcaption></figure>
}
