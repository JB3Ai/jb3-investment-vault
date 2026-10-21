import {calculateCashFlow,cashFlowMonths,cashFlowRowLabels,cashFlowNotice,type CashFlowInput} from './cashFlow.ts'
import {validExchangeRate,financialNote,type FinancialData} from './financialSchedules.ts'
import {encodeWorkbook,type Cell} from './presentationExports.ts'
const formula=(f:string,value:number|null):Cell=>({formula:f,value:value===null?null:value/100})
export function cashFlowWorkbookSheets(data:FinancialData,input:CashFlowInput,rate:number){
 if(!validExchangeRate(rate))throw Error('Invalid exchange rate')
 const m=calculateCashFlow(data,input),last=Math.max(2,m.expenses.length+1),range=(col:string)=>"'Once-Offs'!$"+col+'$2:$'+col+'$'+last
 const inputs:Cell[][]=[['JB³ cash-flow assumptions','Editable inputs / ZAR'],['ZAR per GBP',rate],['Household monthly allowance ZAR',m.household/100],['Core business monthly ZAR',m.businessMonthly/100],['Opening cash ZAR',input.openingCash===null?null:input.openingCash/100],['Zero-income scenario: 1 yes / 0 no',input.zeroIncome?1:0],['Model status',cashFlowNotice],['Calendar','October 2026 to February 2027'],['Treatment','Blank income/cash is unknown; zero is a deliberate assumption. No speculative revenue or litigation proceeds.'],['Monthly inputs',...cashFlowMonths],['Personal income',...input.personalIncome.map(v=>v===null?null:v/100)],['Business income',...input.businessIncome.map(v=>v===null?null:v/100)],['External funding injected',...input.funding.map(v=>v===null?null:v/100)],['Unscheduled known needs ZAR',m.knownUnscheduled/100],['Unknown unscheduled amounts',m.unknownUnscheduled],['Scope','Monthly cash balances exclude unscheduled items. Period funding requirement is peak outstanding, not summed monthly deficits.']]
 const once:Cell[][]=[['Record','Expense description','Personal / Business','Category','Priority','Amount ZAR','Expected payment month','Include: 1 yes / 0 no','Unknown amount flag','Notes / Purpose','Source reference','Original one-off ZAR'],...m.expenses.map((e,i)=>{const r=[...data.personal,...data.business].find(r=>r.id===e.id)!;return [e.id,e.label,e.scope,e.category,e.priority,e.amount===null?null:e.amount/100,e.month??'Unscheduled',e.selected?1:0,{formula:'IF(ISNUMBER(F'+(i+2)+'),0,1)',value:e.amount===null?1:0},e.note,r.provenance.originalFilename+' / '+r.provenance.citation,e.sourceAmount===null?null:e.sourceAmount/100] as Cell[]})]
 const rows:Cell[][]=[['JB³ five-month cash-flow model',cashFlowNotice],['Cash flow / ZAR',...cashFlowMonths,'Period / peak']]
 for(let i=0;i<cashFlowRowLabels.length;i++)rows.push([cashFlowRowLabels[i],...m.rows.map((r,n)=>{const c=String.fromCharCode(66+n)
  let f=''
  if(i<2)f='IF(Inputs!$B$6=1,0,IF(ISNUMBER(Inputs!'+c+(i+11)+'),Inputs!'+c+(i+11)+',""))'
  if(i===2)f='IF(COUNT('+c+'3:'+c+'4)=2,SUM('+c+'3:'+c+'4),"")'
  if(i===3||i===4)f='Inputs!$B$'+(i===3?'3':'4')
  if(i>=5&&i<=7){const cls=i===5?'Personal':'Business',cat=i===7?'CAPEX':'One-off',criteria=range('G')+','+c+'$2,'+range('H')+',1,'+range('D')+',"'+cat+'"'+(i===7?'':','+range('C')+',"'+cls+'"');f='IF(COUNTIFS('+criteria+','+range('I')+',1)>0,"",SUMIFS('+range('F')+','+criteria+'))'}
  if(i===8)f='IF(COUNT('+c+'6:'+c+'10)=5,SUM('+c+'6:'+c+'10),"")'
  if(i===9)f='IF(COUNT('+c+'5,'+c+'11)=2,'+c+'5-'+c+'11,"")'
  if(i===10)f='IF(ISNUMBER(Inputs!'+c+'13),Inputs!'+c+'13,"")'
  if(i===11)f=n===0?'IF(ISNUMBER(Inputs!B5),Inputs!B5,"")':'IF(ISNUMBER('+String.fromCharCode(65+n)+'15),'+String.fromCharCode(65+n)+'15,"")'
  if(i===12)f='IF(COUNT('+c+'12:'+c+'14)=3,SUM('+c+'12:'+c+'14),"")'
  if(i===13)f='IF(ISNUMBER('+c+'15),MAX(0,-'+c+'15),"")'
  return formula(f,r.values[i])
 }),formula(i===11?'IF(ISNUMBER(B14),B14,"")':i===12?'IF(ISNUMBER(F15),F15,"")':i===13?'IF(COUNT(B16:F16)=5,MAX(B16:F16),"")':'IF(COUNT(B'+(i+3)+':F'+(i+3)+')=5,SUM(B'+(i+3)+':F'+(i+3)+'),"")',m.period[i])])
 const gbp:Cell[][]=[['JB³ indicative GBP cash flow','GBP = ZAR / selected rate'],['Cash flow / GBP',...cashFlowMonths,'Period / peak'],...cashFlowRowLabels.map((label,i)=>[label,...Array.from({length:6},(_,j)=>{const ref=String.fromCharCode(66+j)+(i+3),v=j<5?m.rows[j].values[i]:m.period[i];return formula(`IF(ISNUMBER('Cash Flow'!${ref}),'Cash Flow'!${ref}/Inputs!$B$2,"")`,v===null?null:v/rate)})])]
 const sources:Cell[][]=[['Schedule','Source label','Monthly ZAR','One-off ZAR','Source five-month ZAR','Original formula','Approval','Verification','Source file','Citation','Source reference','Source notes'],...(['personal','business'] as const).flatMap(name=>data[name].map(r=>{const n=financialNote(r);return [name,String(r.payload.label),n.monthlyZar===null?null:Number(n.monthlyZar),n.oneOffZar===null?null:Number(n.oneOffZar),typeof r.payload.amountMinor==='number'?r.payload.amountMinor/100:null,n.formula,r.approval,r.verification,r.provenance.originalFilename,r.provenance.citation,r.provenance.sourceReference,n.note]}))]
 return [{name:'Cash Flow',rows},{name:'GBP',rows:gbp},{name:'Inputs',rows:inputs},{name:'Once-Offs',rows:once},{name:'Sources',rows:sources}]
}
export function portableCashFlowWorkbook(data:FinancialData,input:CashFlowInput,rate:number){return encodeWorkbook(cashFlowWorkbookSheets(data,input,rate),true)}
