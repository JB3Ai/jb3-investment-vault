import {useEffect,useRef,useState} from 'react'
import {FileText,LockKeyhole} from 'lucide-react'
import {loadPrivateThumbnail,type LocalReview} from '../lib/localReview'
type Preview=NonNullable<LocalReview['thumbnailPreviews']>[number]
export function EvidencePreview({thumbnail,title,defer=false}:{thumbnail?:Preview;title:string;defer?:boolean}){
 const [source,setSource]=useState(''),[failed,setFailed]=useState(false)
 const host=useRef<HTMLElement>(null),[visible,setVisible]=useState(!defer)
 useEffect(()=>{if(!defer){setVisible(true);return}const element=host.current;if(!element)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'240px'});observer.observe(element);return()=>observer.disconnect()},[defer])
 useEffect(()=>{setSource('');setFailed(false);if(!visible||!thumbnail?.available)return;const controller=new AbortController();let url='';void loadPrivateThumbnail(thumbnail.recordId,controller.signal).then(blob=>{controller.signal.throwIfAborted();url=URL.createObjectURL(blob);setSource(url)}).catch(()=>{if(!controller.signal.aborted)setFailed(true)});return()=>{controller.abort();if(url)URL.revokeObjectURL(url)}},[visible,thumbnail?.recordId,thumbnail?.available,thumbnail?.sha256])
 return <figure ref={host} className="evidence-preview" data-thumbnail-record={thumbnail?.recordId}>{source?<img src={source} alt={`Draft document cover: ${title}`} onError={()=>{setSource('');setFailed(true)}}/>:<div className="evidence-preview-placeholder">{thumbnail&&!thumbnail.available?<LockKeyhole size={36} strokeWidth={1}/>:<FileText size={42} strokeWidth={1}/>}<span>{failed?'Cover unavailable':thumbnail?thumbnail.available?'Loading document cover...':'Document permission required':'Cover not supplied'}</span></div>}<figcaption>{thumbnail?thumbnail.available?'Private / draft evidence':'Separate permission required':'Source document'}<span aria-hidden="true"/></figcaption></figure>
}
