import {useRef,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react'
import {ChevronLeft,ChevronRight} from 'lucide-react'
import type {PortfolioDocument} from '../lib/portfolio'
import type {BrochureEntry} from '../lib/brochures'
export function PortfolioCarousel({entries,index,onChange,cover}:{entries:BrochureEntry<PortfolioDocument>[];index:number;onChange:(index:number)=>void;cover:(document:PortfolioDocument)=>ReactNode}){
 const start=useRef<{x:number;y:number}|null>(null),count=entries.length
 if(!count)return <p className="brochure-empty">No authorised Showcase documents available.</p>
 const current=entries[index%count],previous=entries[(index+count-1)%count],next=entries[(index+1)%count]
 const move=(step:number)=>onChange((index+step+count)%count)
 function key(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(event.key==='Home')onChange(0);else if(event.key==='End')onChange(count-1);else move(event.key==='ArrowRight'?1:-1)}
 function swipe(event:PointerEvent){const first=start.current;start.current=null;if(!first)return;const dx=event.clientX-first.x,dy=event.clientY-first.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1)}
 return <section className="portfolio-carousel" role="region" aria-roledescription="carousel" aria-label="JB³ Showcase brochures" tabIndex={0} onKeyDown={key}>
  <div className="coverflow-stage" onPointerDown={event=>{if(event.pointerType==='touch')start.current={x:event.clientX,y:event.clientY}}} onPointerUp={swipe} onPointerCancel={()=>{start.current=null}}>
   {count>1&&<button className="coverflow-neighbour coverflow-previous" aria-label={'Select previous brochure: '+previous.document.title} onClick={()=>move(-1)} tabIndex={-1}>{cover(previous.document)}</button>}
   <div className="coverflow-current" data-showcase-cover={current.document.id}>{cover(current.document)}</div>
   {count>1&&<button className="coverflow-neighbour coverflow-next" aria-label={'Select next brochure: '+next.document.title} onClick={()=>move(1)} tabIndex={-1}>{cover(next.document)}</button>}
  </div>
  <div className="coverflow-controls"><button onClick={()=>move(-1)} disabled={count<2} aria-label="Previous Showcase brochure"><ChevronLeft size={20}/></button><p role="status" aria-live="polite" aria-atomic="true"><strong>{String(index+1).padStart(2,'0')}</strong><span> / {String(count).padStart(2,'0')}</span><small>{current.document.title}</small></p><button onClick={()=>move(1)} disabled={count<2} aria-label="Next Showcase brochure"><ChevronRight size={20}/></button></div>
 </section>
}
