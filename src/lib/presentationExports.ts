import { zipSync, strToU8 } from 'fflate'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { financialNote, sourceMinor, totals, validExchangeRate, money, type FinancialData, type ExportScope } from './financialSchedules'
import { fundingSummary } from './fundingProposal'
import { financialScenarios, emptySustainable, type SustainableInput } from './financialScenarios'
import type { LocalReview } from './localReview'
const xml=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
type Cell=string|number|null|{formula:string;value:number|null}
const formula=(formula:string,value:number|null):Cell=>({formula,value})
export function presentationWorkbook(data:FinancialData,scope:ExportScope,rate:number,scenario:SustainableInput){
 if(!validExchangeRate(rate))throw Error('Invalid exchange assumption')
 const names=scope==='combined'?['personal','business'] as const:[scope], sheets:{name:string;rows:Cell[][]}[]=[]
 const all=names.flatMap(name=>data[name]),summary=totals(all),funding=scope==='combined'?fundingSummary(data):null
 sheets.push({name:'Summary',rows:[['JB³ financial schedules','DRAFT / working estimates'],['Currency','ZAR primary; GBP indicative'],['Scope',scope],['Known source baseline ZAR',summary.baseline/100],['Optional hardware ZAR',summary.optional/100],['Known source total ZAR',summary.known/100],['Unknown amounts excluded',summary.unresolved],['GBP source total',formula("B6/Assumptions!$B$2",summary.known/100/rate)],['Core recurring funding ZAR',funding?funding.coreMinor/100:null],['Core plus known one-offs ZAR',funding?funding.knownRequirementsMinor/100:null],['Treatment','Source subtotals are supporting detail, not additional funding obligations.'],['Exclusions','Unknown values are not zero. Optional hardware and conditional costs are excluded from core needs. No forecast revenue assumed.']]})
 sheets.push({name:'Assumptions',rows:[['Assumption','Value'],['ZAR per GBP',rate],['Planning months',5],['Rate source',data.exchangeRate?.source??'Owner assumption'],['Rate date',data.exchangeRate?.asOf??'Not confirmed'],['Status','DRAFT / editable review assumption'],['Approval','Original record approval and verification status are unchanged.']]})
 const sourceRows:Cell[][]=[['Schedule','Record','Source file','Citation','Source reference','Original formula','Reconciliation notes','Approval','Verification']]
 for(const name of names){const rows:Cell[][]=[['Purpose','One-off ZAR','Monthly ZAR','Five-month ZAR','Indicative GBP','Category','Status']]
  data[name].forEach((record,index)=>{const n=financialNote(record),row=index+2,known=typeof record.payload.amountMinor==='number'?record.payload.amountMinor/100:null
   rows.push([String(record.payload.label),n.oneOffZar===null?null:sourceMinor(n.oneOffZar)!/100,n.monthlyZar===null?null:sourceMinor(n.monthlyZar)!/100,formula('IF(COUNT(B'+row+':C'+row+')=0,"",ROUND(N(B'+row+')+N(C'+row+')*Assumptions!$B$3,2))',known),formula('IF(ISNUMBER(D'+row+'),ROUND(D'+row+'/Assumptions!$B$2,2),"")',known===null?null:Math.round(known/rate*100)/100),n.optionalHardware?'Optional hardware':'Source detail',record.approval+' / '+record.verification+(known===null?' / UNKNOWN':'')])
   sourceRows.push([name,record.id,record.provenance.originalFilename,record.provenance.citation,record.provenance.sourceReference,n.formula,n.note,record.approval,record.verification])
  });sheets.push({name:name==='personal'?'Personal':'Business',rows})
 }
 const scoped={...data,personal:scope==='business'?[]:data.personal,business:scope==='personal'?[]:data.business},exportedScenario=scope==='business'?emptySustainable:scenario,s=financialScenarios(scoped,exportedScenario)
 sheets.push({name:'Budget scenarios',rows:[['Scenario','DRAFT / reviewer inputs'],['Minimum operating ZAR',s.minimumMinor/100],['Sustainable five-month ZAR',s.sustainableMinor===null?null:s.sustainableMinor/100],['Selected ZAR per GBP',rate],['Source assumptions',JSON.stringify(exportedScenario)]]})
 sheets.push({name:'Source notes',rows:sourceRows})
 const files:Record<string,Uint8Array>={}
 function put(n:string,s:string){files[n]=strToU8(s)}
 put('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>')
 put('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
 put('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><calcPr fullCalcOnLoad="1"/></workbook>')
 put('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>')
 const column=(n:number)=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s}
 sheets.forEach((s,i)=>put('xl/worksheets/sheet'+(i+1)+'.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="48" customWidth="1"/><col min="2" max="9" width="24" customWidth="1"/></cols><sheetData>'+s.rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>{const ref=column(c)+(r+1);return v===null?'<c r="'+ref+'"/>':typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':typeof v==='object'?'<c r="'+ref+'"><f>'+xml(v.formula)+'</f>'+(v.value===null?'':'<v>'+v.value+'</v>')+'</c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>'))
 return zipSync(files)
}
export async function presentationPdf(data:LocalReview,rate:number,scenario:SustainableInput,loadImage?:(id:string)=>Promise<Uint8Array>){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.TimesRoman),bold=await pdf.embedFont(StandardFonts.TimesRomanBold)
 pdf.setTitle('JB³ Private Investment Presentation');pdf.setAuthor('Jonathan Blackburn')
 let page=pdf.addPage([595.28,841.89]),y=780
 const safe=(text:string)=>Array.from(text).map(c=>{try{font.encodeText(c);return c}catch{return ' '}}).join('')
 function line(text:string,size=11,heading=false){if(y<58){page=pdf.addPage([595.28,841.89]);y=780}page.drawText(safe(text),{x:52,y,size,font:heading?bold:font,color:heading?rgb(.28,.24,.16):rgb(.12,.12,.11)});y-=size*1.45}
 function paragraph(text:string,size=11,heading=false){for(const original of text.replace(/\*\*/g,'').split('\n')){let row='';for(const word of original.split(/\s+/)){const next=(row?row+' ':'')+word;if(font.widthOfTextAtSize(safe(next),size)>490&&row){line(row,size,heading);row=word}else row=next}if(row)line(row,size,heading);else y-=8}y-=8}
 paragraph('JB³ PRIVATE INVESTMENT VAULT',18,true);paragraph('Prepared for Bruce Blackburn',12);paragraph('Temporary presentation copy. Draft figures and evidence retain their original status. Restricted and confidential supporting files are omitted.',10)
 async function laboratory(){if(!data.laboratory)return;paragraph(data.laboratory.title,16,true);for(const record of data.laboratory.records??[])if(typeof record.payload.body==='string')paragraph(record.payload.body);paragraph('Founder-provided display sequence. Dates, certification and independent chronology remain subject to verification. Photographs retain draft evidence status.',10)
  for(const record of data.laboratory.photographs){
   if(loadImage){const image=await pdf.embedJpg(await loadImage(record.id));page=pdf.addPage([595.28,841.89]);y=780;paragraph(data.laboratory.title,14,true);const size=image.scaleToFit(490,590);page.drawImage(image,{x:52+(490-size.width)/2,y:y-size.height,width:size.width,height:size.height});y-=size.height+18}
   paragraph(String(record.payload.caption),10);paragraph('Source: '+record.provenance.originalFilename+' / '+record.approval+' / '+record.verification,8)
  }
 }
 for(const s of data.sections){paragraph(s.narrative.payload.heading,16,true);paragraph(s.narrative.payload.body);if(s.id==='history-evidence')await laboratory()}

 paragraph('Personal and business financial schedules',16,true);paragraph('ZAR primary. GBP = ZAR / '+rate+'. Editable illustrative assumption; unresolved values excluded, not zero. Draft estimates are not agreed obligations.',10)
 for(const name of ['personal','business'] as const){paragraph(name==='personal'?'Personal':'Business',13,true);for(const r of data.finances[name]){const n=typeof r.payload.amountMinor==='number'?r.payload.amountMinor:null;paragraph(String(r.payload.label)+': '+(n===null?'Unresolved':money(n)+' / '+money(Math.round(n/rate),'GBP'))+' ('+r.approval+')',10)}}
 const funding=fundingSummary(data.finances);if(funding)paragraph('Indicative core plus known one-offs: '+money(funding.knownRequirementsMinor)+' / '+money(Math.round(funding.knownRequirementsMinor/rate),'GBP')+'. Unknown, optional and conditional amounts remain excluded.',11,true)
 if(data.commercial){paragraph('Commercial capability & opportunity register',16,true);for(const entry of data.commercial.entries){paragraph(entry.title,12,true);paragraph(entry.positioning,10);for(const limitation of entry.limitations)paragraph(limitation,9)}paragraph('Uncontracted forecast pipeline revenue remains ZAR 0. Proposals and prototypes are not signed contracts or confirmed income.',10)}
 if(data.documents.length){paragraph('Supporting brochures and documents',16,true);for(const record of data.documents){paragraph(String(record.payload.title),11,true);paragraph(record.provenance.originalFilename+' / '+record.approval+' / '+record.verification,9)}}
 const selected=financialScenarios(data.finances,scenario);paragraph('Budget scenarios',14,true);paragraph('Minimum operating baseline: '+money(selected.minimumMinor)+'. Sustainable scenario: '+(selected.sustainableMinor===null?'Owner inputs required':money(selected.sustainableMinor)+' / '+money(Math.round(selected.sustainableMinor/rate),'GBP'))+'. No speculative revenue is assumed.',10)
 for(const [i,p]of pdf.getPages().entries())p.drawText('JB³ / Bruce Blackburn / '+(i+1),{x:52,y:30,size:8,font,color:rgb(.4,.4,.4)})
 return pdf.save()
}
