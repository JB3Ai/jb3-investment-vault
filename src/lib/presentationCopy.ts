/** Presentation only. Never use this projection for ingestion, hashing or authorisation. */
const atom = /(?:https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\bJB3_[A-Z0-9_]+\b|\bJB(?:3| 3|³)(?:Ai)?[\w³.-]*\.(?:pdf|xlsx?|xlsm|png|jpe?g|md|json)\b|\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b|\x60[^\x60]+\x60|"[^"\n]+"|“[^”\n]+”|^\s*>[^\n]*|^\s*\x60\x60\x60[\s\S]*?^\s*\x60\x60\x60)/gm
const brand = /JB(?: 3|3|³)(?:Ai|AI|ai)?(?![\p{L}\p{N}_])/gu
export function presentationText(input: string): string {
  // Protect original quotations, code, domains, addresses and inline source filenames.
  const protectedParts: string[] = []
  let value = input.replace(atom, text => { protectedParts.push(text); return '\u0000' + (protectedParts.length-1) + '\u0000' })
  value = value.replace(brand, (name, offset: number) => {
    const context = value.slice(Math.max(0,offset-60),offset+name.length+60)
    return /Ai$/i.test(name) && /legal entity|legal name|registered (?:company|entity)|contracting entity|\(Pty\)|\bLtd\b/i.test(context) ? name : 'JB³'
  })
  value = value.split('\n').map(line => {
    line = line.replace(/(\d)\s*—\s*(?=\d)/g,'$1 to ')
    // Two interrupting dashes become parentheses; a single dash introduces a
    // clarification (colon), or joins a dependent/conjunctive clause (comma).
    line = line.replace(/\s*—\s*([^—\n]+?)\s*—\s*/g,(_,aside:string)=>' ('+aside.trim()+') ')
    line = line.replace(/\s*—\s*/g,(_match,offset:number,whole:string)=>{
      const right=whole.slice(offset+_match.length)
      if (!whole.slice(0,offset).trim()) return ''
      return /^(?:and|but|or|not|with|without|which|while|because|rather|although|including|where|when|whether)\b/i.test(right)?', ':': '
    })
    return line
  }).join('\n')
  return value.replace(/\u0000(\d+)\u0000/g,(_,index:string)=>protectedParts[Number(index)])
}
const displayKeys = new Set(['body','heading','title','subtitle','overview','label','description','caption','alt','association','documentType','positioning','limitations','missingEvidence','ownershipNote','statusBasis','summary','verificationHolds','verificationNotes','valuationBasis','ownershipEvidence','encumbrances','claimStage','recoveryBasis','inclusions','note','reason','action','periodBasis','amountBasis'])
const verbatimKeys = new Set(['provenance','file','metadata','source','sourceReferences','sourceDocuments','assertions','independentlyVerifiedFacts','originalFilename','filename','relativePath','storage_path','sha256','workbook','citation','sourceReference','reconciliationNote'])
/** Clone display fields only. Record IDs, sources, approvals, figures and formulas stay unchanged. */
export function presentationView<T>(input:T):T {
  function project(value:unknown,key=''):unknown {
    if(verbatimKeys.has(key))return value
    if(typeof value==='string')return displayKeys.has(key)?presentationText(value):value
    if(Array.isArray(value))return value.map(item=>project(item,key))
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,project(item,name)]))
    return value
  }
  return project(input) as T
}
export function textQualityIssues(value:string, options:{verbatimQuotes?:boolean}={}): string[] {
  const protectedText=value.replace(atom,part=>!options.verbatimQuotes&&/^["“]/.test(part)?part:'').replace(/\bJB(?:3| 3|³)Ai(?=\s*(?:\(Pty\)|Ltd\b))/g,'')
  const issues:string[]=[]
  if([...protectedText.matchAll(/JB(?:3| 3)(?:Ai|AI|ai)?(?![\p{L}\p{N}_])|JB³(?:Ai|AI|ai)(?![\p{L}\p{N}_])/gu)].some(match=>!(match[0]==='JB³Ai'&&/legal entity|legal name|registered (?:company|entity)|contracting entity|\(Pty\)|\bLtd\b/i.test(protectedText.slice(Math.max(0,match.index!-60),match.index!+match[0].length+60)))))issues.push('brand')
  if(protectedText.includes('—'))issues.push('em-dash')
  return issues
}
