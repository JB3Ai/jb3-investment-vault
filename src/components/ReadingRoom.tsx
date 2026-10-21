import {ArrowLeft} from 'lucide-react'
import {SectionIndex} from './SectionIndex'
import type {VaultSection} from '../types'
export function ReadingRoom({sections,selected,onOpen,onLaboratory,onBack}:{sections:VaultSection[];selected:string;onOpen:(id:string)=>void;onLaboratory?:()=>void;onBack:()=>void}){
 return <main id="main-content" className="reader reading-room"><button className="text-button" onClick={onBack}><ArrowLeft size={16}/>Back to Console</button><header className="reader-heading"><span className="metadata">PRIVATE INVESTMENT PRESENTATION</span><h1>Reading Room</h1><p>Eleven chapters, with the laboratory photographic interlude.</p></header><SectionIndex sections={sections} selected={selected} onSelect={onOpen} onOpen={onOpen} onLaboratory={onLaboratory}/></main>
}
