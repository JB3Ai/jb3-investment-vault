/** Exact owner-authorised editorial exclusion; never modify canonical source records. */
export const internalStructuralNote = 'Important structural note (not necessarily part of displayed letter)'
export function investorNarrative(body:string):string {
 const blocks=body.replace(/\r\n/g,'\n').split(/\n[\t ]*\n/)
 const retained=blocks.filter(block=>!block.trimStart().replace(/^\*\*/,'').startsWith(internalStructuralNote+':')&&!block.trimStart().replace(/^\*\*/,'').startsWith(internalStructuralNote+'**:'))
 return retained.length===blocks.length?body:retained.join('\n\n')
}
export type NarrativeBlock={type:'paragraph';body:string}|{type:'heading';body:string;level:number}|{type:'rule'}|{type:'list';ordered:boolean;start:number;items:string[]}|{type:'table';headers:string[];rows:string[][]}
/** Blank lines delimit paragraphs; soft Markdown line wraps do not add visual breaks. */
export function narrativeBlocks(input:string):NarrativeBlock[]{
 const blocks:NarrativeBlock[]=[];let paragraph:string[]=[],list:Extract<NarrativeBlock,{type:'list'}>|undefined
 const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',body:paragraph.join('\n').trim()});paragraph=[]}if(list){blocks.push(list);list=undefined}}
 const lines=investorNarrative(input).replace(/\r\n/g,'\n').split('\n')
 for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
  const line=lines[lineIndex],header=markdownCells(line),separator=markdownCells(lines[lineIndex+1]??'')
  if(header.length>1&&separator.length===header.length&&separator.every(cell=>/^:?-{3,}:?$/.test(cell))){
   flush();const rows:string[][]=[];lineIndex++;while(lineIndex+1<lines.length){const row=markdownCells(lines[lineIndex+1]);if(row.length!==header.length)break;rows.push(row);lineIndex++}blocks.push({type:'table',headers:header,rows});continue
  }
  const heading=line.match(/^\s*(#{1,6})\s+(.+)$/),item=line.match(/^\s*(?:([-+*])|(?:(\d+)[.)]))\s+(.+)$/)
  if(!line.trim())flush()
  else if(heading){flush();blocks.push({type:'heading',body:heading[2],level:heading[1].length})}
  else if(/^\s*---+\s*$/.test(line)){flush();blocks.push({type:'rule'})}
  else if(item){const ordered=!!item[2];if(paragraph.length||list&&list.ordered!==ordered)flush();list??={type:'list',ordered,start:Number(item[2]??1),items:[]};list.items.push(item[3])}
  else if(list&&/^\s{2,}/.test(line))list.items[list.items.length-1]+='\n'+line.trim()
  else{if(list)flush();paragraph.push(line)}
 }
 flush();return blocks
}

/** Only structural Markdown pipes delimit cells; escaped pipes remain source text. */
function markdownCells(line:string):string[]{
 const value=line.trim();if(!value.includes('|'))return []
 const cells=value.replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'))
 return cells.length>1?cells:[]
}
