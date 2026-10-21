import {useEffect,useState} from 'react'
import {localReviewFetch} from '../lib/localReview'
import type {ContentRecord} from '../../content-migration/ingestion-schema'
import '../styles/section-visual.css'

/** Runtime-only, classified intake image; never import private source bytes. */
export function SectionVisual({record}:{record:ContentRecord}){
 const [source,setSource]=useState(''),[failed,setFailed]=useState(false)
 useEffect(()=>{
  setSource('');setFailed(false)
  const controller=new AbortController();let url=''
  void localReviewFetch('assets/'+record.id,controller.signal).then(async response=>{
   if(!record.file||response.headers.get('content-type')!==record.file.mimeType||!response.headers.get('cache-control')?.includes('no-store'))throw Error('Private image unavailable')
   const blob=await response.blob();controller.signal.throwIfAborted();url=URL.createObjectURL(blob);setSource(url)
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true)})
  return()=>{controller.abort();if(url)URL.revokeObjectURL(url)}
 },[record.id,record.file?.sha256,record.file?.mimeType])
 return <figure className="section-visual" aria-label="Supporting visual showcase">
  {source?<img src={source} alt={String(record.payload.alt)} onError={()=>setFailed(true)} hidden={failed}/>:null}
  {!source&&!failed&&<p role="status">Loading supporting image...</p>}
  {failed&&<p role="status">Supporting image unavailable. Check the private intake source and checksum.</p>}
  <figcaption>{String(record.payload.caption)}</figcaption>
 </figure>
}
