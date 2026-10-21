import {presentationText} from '../lib/presentationCopy'
import {narrativeBlocks} from '../lib/narrativePresentation'
import {Fragment,type ReactNode} from 'react'
function inline(text:string){
 // Preserve explicit Markdown hard breaks; ordinary line wraps collapse to spaces.
 const value=text.replace(/(?: {2,}|\\)\n/g,'\u0000').replace(/\n/g,' ')
 return value.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|\u0000)/g).map((part,index)=>part==='\u0000'?<br key={index}/>:part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={index}>{part.slice(1,-1)}</em>:<Fragment key={index}>{part}</Fragment>)
}
export function NarrativeText({body,afterBlock}:{body:string;afterBlock?:(index:number)=>ReactNode}){
 return <>{narrativeBlocks(presentationText(body)).map((block,index)=>{
  if(block.type==='table')return <div className="narrative-register" key={index}><div className="narrative-register-table" tabIndex={0} role="region" aria-label="Narrative opportunity register"><table><thead><tr>{block.headers.map((heading,i)=><th scope="col" key={i}>{inline(heading)}</th>)}</tr></thead><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}>{inline(cell)}</th>:<td key={j}>{inline(cell)}</td>)}</tr>)}</tbody></table></div><div className="narrative-register-cards">{block.rows.map((row,i)=><article key={i}><h4>{inline(row[0])}</h4><dl>{row.slice(1).map((cell,j)=><div key={j}><dt>{inline(block.headers[j+1])}</dt><dd>{inline(cell)}</dd></div>)}</dl></article>)}</div></div>
  if(block.type==='rule')return <hr key={index}/>
  if(block.type==='heading')return block.level<=3?<h3 key={index}>{inline(block.body)}</h3>:<h4 key={index}>{inline(block.body)}</h4>
  if(block.type==='list'){const children=block.items.map((item,i)=><li key={i}>{inline(item)}</li>);return block.ordered?<ol start={block.start} key={index}>{children}</ol>:<ul key={index}>{children}</ul>}
  const reference=afterBlock?.(index)
  return reference?<div className="narrative-block-with-reference" key={index}><p>{inline(block.body)}</p>{reference}</div>:<p key={index}>{inline(block.body)}</p>
 })}</>
}
