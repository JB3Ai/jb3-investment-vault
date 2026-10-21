import type {ReaderPreferences} from '../lib/readerPreferences'
import '../styles/reader-typography.css'
export function ReaderTextControls({preferences,onChange}:{preferences:ReaderPreferences;onChange:(patch:Partial<ReaderPreferences>)=>void}){
 return <div className="reader-text-controls no-print" role="group" aria-label="Reading preferences">
  <div role="group" aria-label="Narrative text size"><button type="button" aria-label="Decrease narrative text size" disabled={preferences.fontSize<=14} onClick={()=>onChange({fontSize:preferences.fontSize-1})}>A−</button><output aria-live="polite" aria-label="Narrative font size">{preferences.fontSize}px</output><button type="button" aria-label="Increase narrative text size" disabled={preferences.fontSize>=21} onClick={()=>onChange({fontSize:preferences.fontSize+1})}>A+</button></div>
  <div role="group" aria-label="Reading density">{(['compact','comfortable'] as const).map(density=><button type="button" key={density} aria-pressed={preferences.density===density} onClick={()=>onChange({density})}>{density==='compact'?'Compact':'Comfortable'}</button>)}</div>
 </div>
}
