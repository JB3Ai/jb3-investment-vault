import {useEffect,useState,type CSSProperties} from 'react'
export interface ReaderPreferences {fontSize:number;density:'compact'|'comfortable'}
export const readerPreferenceKey='jb3.reader.preferences.v1'
const defaults:ReaderPreferences={fontSize:16,density:'comfortable'}
let fallback={...defaults}
export function parseReaderPreferences(value:unknown):ReaderPreferences{
 const input=value as Partial<ReaderPreferences>|null
 return {fontSize:typeof input?.fontSize==='number'&&Number.isFinite(input.fontSize)?Math.min(21,Math.max(14,Math.round(input.fontSize))):16,density:input?.density==='compact'?'compact':'comfortable'}
}
function read(){try{const raw=sessionStorage.getItem(readerPreferenceKey);return raw?parseReaderPreferences(JSON.parse(raw)):fallback}catch{return fallback}}
export function useReaderPreferences(){
 const [preferences,setPreferences]=useState<ReaderPreferences>(read)
 useEffect(()=>{const sync=(event:Event)=>setPreferences((event as CustomEvent<ReaderPreferences>).detail);window.addEventListener('jb3-reader-preferences',sync);return()=>window.removeEventListener('jb3-reader-preferences',sync)},[])
 function update(patch:Partial<ReaderPreferences>){const next=parseReaderPreferences({...preferences,...patch});fallback=next;try{sessionStorage.setItem(readerPreferenceKey,JSON.stringify(next))}catch{/* In-memory preferences remain available if storage is blocked. */}setPreferences(next);window.dispatchEvent(new CustomEvent('jb3-reader-preferences',{detail:next}))}
 const style={'--reader-font-size':preferences.fontSize/16+'rem','--reader-paragraph-gap':preferences.density==='compact'?'.5rem':'.75rem'} as CSSProperties
 return {preferences,update,style}
}
