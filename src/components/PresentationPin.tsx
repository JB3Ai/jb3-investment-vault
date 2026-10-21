import {BuildReference} from './BuildReference'
import {useEffect,useRef,useState,type KeyboardEvent} from 'react'
import {LockKeyhole,ArrowLeft} from 'lucide-react'
import { matchesPresentationPin } from '../lib/landingState'
import '../styles/presentation-pin.css'
export function PresentationPin({onBack,onSuccess,onInteract}:{onBack:()=>void;onSuccess:()=>void;onInteract:()=>void}){
 const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[until,setUntil]=useState(0),[remaining,setRemaining]=useState(0)
 const host=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),pending=useRef<AbortController|null>(null)
 useEffect(()=>{input.current?.focus();return()=>pending.current?.abort()},[])
 useEffect(()=>{if(!busy&&!remaining)input.current?.focus()},[busy,remaining])
 useEffect(()=>{if(!until)return;const update=()=>setRemaining(Math.max(0,Math.ceil((until-Date.now())/1000)));update();const timer=setInterval(update,250);return()=>clearInterval(timer)},[until])
 async function submit(){
  if(busy||remaining||value.length!==4)return
  onInteract()
  // Hosted PIN is cosmetic: no token, cookie, grant or server-side session is created.
  // Local owner review keeps its existing server-side check, separate from hosted access.
  if(!(import.meta.env.DEV && import.meta.env.MODE === 'private-local')){
   if(matchesPresentationPin(value)){setValue('');onSuccess()}
   else{setError('That PIN was not accepted. Try again.');setValue('');input.current?.focus()}
   return
  }
  setBusy(true);setError('');const controller=new AbortController();pending.current=controller
  try{const response=await fetch('/api/vault/local-review/presentation-pin',{method:'POST',headers:{'X-Vault-Local-Review':'1','Content-Type':'application/json'},body:JSON.stringify({pin:value}),cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});if(!response.headers.get('cache-control')?.includes('no-store'))throw Error();if(response.status===429){const seconds=Math.min(60,Math.max(1,Number(response.headers.get('retry-after'))||30));setUntil(Date.now()+seconds*1000);setRemaining(seconds);setError('Please pause before trying again.')}else if(response.ok&&(await response.json()).ok===true){setValue('');onSuccess()}else{setError('That PIN was not accepted. Try again.');setValue('');input.current?.focus()}}
  catch{if(!controller.signal.aborted)setError('Entry check unavailable. Please try again.')}
  finally{if(!controller.signal.aborted)setBusy(false)}
 }
 function key(event:KeyboardEvent<HTMLDivElement>){if(event.key==='Escape'){event.preventDefault();onBack()}if(event.key==='Tab'){const items=Array.from(host.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}
 return <div className="pin-backdrop"><div ref={host} role="dialog" aria-modal="true" aria-labelledby="presentation-pin-title" aria-describedby="presentation-pin-note" className="presentation-pin" onKeyDown={key}><LockKeyhole size={23} aria-hidden="true"/><h2 id="presentation-pin-title">Enter your PIN</h2><p id="presentation-pin-note">Four digits to begin the presentation.<br/>Confidential access is verified separately.</p><form onSubmit={event=>{event.preventDefault();void submit()}}><label className="sr-only" htmlFor="presentation-pin">Presentation PIN</label><input ref={input} id="presentation-pin" aria-label="Presentation PIN" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" maxLength={4} value={value} disabled={busy||remaining>0} onChange={event=>setValue(event.target.value.replace(/\D/g,'').slice(0,4))}/><div className="pin-keypad" aria-label="Numeric keypad">{['1','2','3','4','5','6','7','8','9','0'].map(digit=><button type="button" key={digit} aria-label={'Digit '+digit} disabled={busy||remaining>0||value.length>=4} onClick={()=>{setValue(current=>(current+digit).slice(0,4));onInteract()}}>{digit}</button>)}</div><p className="pin-feedback" role="status" aria-live="polite">{remaining?'Try again in '+remaining+' seconds.':error||' '}</p><div className="pin-actions"><button type="button" onClick={onBack}><ArrowLeft size={14}/>Back</button><button type="button" disabled={busy} onClick={()=>{setValue('');setError('');input.current?.focus()}}>Clear</button><button type="submit" disabled={busy||remaining>0||value.length!==4}>{busy?'Checking...':'Enter'}</button></div></form><footer className="pin-build"><BuildReference/></footer></div></div>
}
