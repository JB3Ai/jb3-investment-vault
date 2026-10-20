import assert from 'node:assert/strict'
// Scan runtime copy, not identifiers, fixtures, CSS, private sources or original documents.
import {parseSync} from 'rolldown/experimental'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {textQualityIssues} from '../src/lib/presentationCopy.ts'
const skipTypes=new Set(['ImportDeclaration','TSInterfaceDeclaration','TSTypeAliasDeclaration','TSTypeAnnotation','TSLiteralType','RegExpLiteral'])
const technicalAttributes=new Set(['className','id','key','href','src','type','name','htmlFor','value','style','download'])
const technicalAssignments=new Set(['download','href','src'])
const technicalProperties=new Set(['id','key','url','href','src','format','bucket','table','column','route','path','relativePath','storage_path','filename','originalFilename','sha256','hash','sourceReference','citation','provenance'])
const technicalCalls=new Set(['from','select','eq','in','order','getItem','setItem','removeItem','querySelector','querySelectorAll','getElementById'])
export function inspectCopy(source,filename){
 const issues=[]
 function check(value,start){if(typeof value!=='string')return;for(const issue of textQualityIssues(value))issues.push({file:filename,line:source.slice(0,start).split('\n').length,issue})}
 const parsed=parseSync(filename,source)
 if(parsed.errors.length)throw Error('Copy parser failed: '+filename)
 function walk(node){
  if(!node||typeof node!=='object')return
  if(skipTypes.has(node.type))return
  if(node.type==='JSXAttribute'&&(technicalAttributes.has(node.name?.name)||node.name?.name?.startsWith('data-')))return
  if(node.type==='AssignmentExpression'&&technicalAssignments.has(node.left?.property?.name))return
  if(node.type==='Property'&&!node.computed){if(!technicalProperties.has(node.key?.name??node.key?.value))walk(node.value);return}
  if(node.type==='CallExpression'&&technicalCalls.has(node.callee?.property?.name))return
  if(node.type==='CallExpression'&&node.callee?.name==='fetch'){node.arguments.slice(1).forEach(walk);return}
  if(node.type==='JSXText'||node.type==='Literal'||node.type==='StringLiteral')check(node.value,node.start)
  if(node.type==='TemplateElement')check(node.value.cooked,node.start)
  for(const [key,value]of Object.entries(node)){if(['parent','raw','comments','errors'].includes(key))continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)}
 }
 walk(parsed.program);return issues
}
function verifyChecker(){
 const cases=[['const JB3_ID=1',0],['const x=<h1>JB3 interface</h1>',1],['const x=<button aria-label="JB 3 vault"/>',1],['const x=<p>JB³ interface</p>',0],['const x="JB3_PRIVATE_CONTENT_V1"',0],['link.download="JB3-"+scope+".xlsx"',0],['const x=<p>Scope \u2014 pending</p>',1],['const x=<p>JB³Ai (Pty) Ltd</p>',0],["fetch('/api/JB3')",0],["const x={id:'JB3-record',title:'JB3 interface'}",1]]
 for(const [source,count]of cases)assert.equal(inspectCopy(source,'synthetic.tsx').length,count,'Visible-copy checker scope regression')
}
export function checkVisibleCopy(){
 verifyChecker();let files=0;const issues=[]
 function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(/\.(tsx?|mjs)$/.test(entry.name)&&!/(?:\.test|\.spec)\./.test(entry.name)&&!file.endsWith('presentationCopy.ts')){files++;issues.push(...inspectCopy(fs.readFileSync(file,'utf8'),file))}}}
 scan('src');for(const file of ['server/financialExport.ts','server/fundingWorkbook.ts','server/masterPdf.ts','content-migration/master-content.ts']){files++;issues.push(...inspectCopy(fs.readFileSync(file,'utf8'),file))}
 const decode=value=>value.replace(/&(?:mdash|#8212|#x2014);/gi,'\u2014').replace(/&(?:sup3|#179|#xb3);/gi,'\u00b3').replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
 for(const file of ['index.html','public/favicon.svg']){const html=fs.readFileSync(file,'utf8');files++;for(const match of html.matchAll(/>([^<>]+)<|(?:aria-label|title|alt|placeholder|content)="([^"]*)"/g))for(const issue of textQualityIssues(decode(match[1]??match[2])))issues.push({file,line:html.slice(0,match.index).split('\n').length,issue})}
 // Python renderer's own literal copy only. Dynamic evidence is checked separately,
 // and its original documents, provenance fields and quotations remain verbatim.
 const python=fs.readFileSync('server/master_pdf.py','utf8');files++;for(const match of python.matchAll(/(['"])((?:\\.|(?!\1)[^\r\n\\])*?)\1/g)){for(const issue of textQualityIssues(decode(match[2])))issues.push({file:'server/master_pdf.py',line:python.slice(0,match.index).split('\n').length,issue})}
 return {files,issues}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const result=checkVisibleCopy();console.log(JSON.stringify({check:'visible-copy',passed:result.issues.length===0,...result}));process.exitCode=result.issues.length?1:0}
