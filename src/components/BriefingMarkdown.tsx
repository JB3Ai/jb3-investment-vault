import { Fragment } from 'react'
import { NarrativeText } from './NarrativeText'
/** Preserve paragraph blocks and words; Markdown markers are presentation syntax. */
export function BriefingMarkdown({body}:{body:string}){
 const blocks: {type:'paragraph'|'heading'|'rule';body:string;level?:number}[]=[]
 let paragraph:string[]=[]
 const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',body:paragraph.join('\n')});paragraph=[]}}
 for(const line of body.replace(/\r\n/g,'\n').split('\n')){const heading=line.match(/^(#{1,6})\s+(.+)$/);if(!line.trim()){flush()}else if(heading){flush();blocks.push({type:'heading',body:heading[2],level:heading[1].length})}else if(/^---+$/.test(line.trim())){flush();blocks.push({type:'rule',body:''})}else paragraph.push(line)}flush()
 return <>{blocks.map((block,index)=><Fragment key={index}>{block.type==='rule'?<hr/>:block.type==='heading'?block.level!<=3?<h3>{block.body.replace(/\*\*/g,'')}</h3>:<h4>{block.body.replace(/\*\*/g,'')}</h4>:<NarrativeText body={block.body}/>}</Fragment>)}</>
}
