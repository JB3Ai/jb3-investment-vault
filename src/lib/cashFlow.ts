import type {FinancialData} from './financialSchedules.ts'
import {financialNote,sourceMinor} from './financialSchedules.ts'
import {fundingRow} from './fundingProposal.ts'
export const cashFlowMonths=['2026-10','2026-11','2026-12','2027-01','2027-02'] as const
export const cashFlowNotice='Illustrative working estimates. Subject to final reconciliation before investment.'
export type CashMonth=typeof cashFlowMonths[number]
export interface CashFlowInput {personalIncome:(number|null)[];businessIncome:(number|null)[];funding:(number|null)[];openingCash:number|null;zeroIncome:boolean;allocations:Record<string,{month:CashMonth|null;selected:boolean}>}
export const emptyCashFlow=():CashFlowInput=>({personalIncome:Array(5).fill(null),businessIncome:Array(5).fill(null),funding:Array(5).fill(0),openingCash:null,zeroIncome:false,allocations:{}})
export function validCashFlow(value:unknown):CashFlowInput{
 const v=value as CashFlowInput,money=(n:unknown)=>n===null||Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000000000
 if(!v||Object.keys(v).sort().join(',')!=='allocations,businessIncome,funding,openingCash,personalIncome,zeroIncome'||typeof v.zeroIncome!=='boolean'||![v.personalIncome,v.businessIncome,v.funding].every(a=>Array.isArray(a)&&a.length===5&&a.every(money))||!(v.openingCash===null||Number.isSafeInteger(v.openingCash)&&Math.abs(v.openingCash)<=10000000000)||!v.allocations||typeof v.allocations!=='object'||Array.isArray(v.allocations)||Object.keys(v.allocations).length>100)throw Error('Invalid cash-flow assumptions')
 for(const [id,a] of Object.entries(v.allocations))if(!/^[a-f0-9-]{36}$/.test(id)||!a||Object.keys(a).sort().join(',')!=='month,selected'||typeof a.selected!=='boolean'||a.month!==null&&!cashFlowMonths.includes(a.month))throw Error('Invalid one-off allocation')
 return v
}
export interface CashExpense {id:string;label:string;scope:'Personal'|'Business';category:'One-off'|'CAPEX';priority:'Urgent'|'Planned'|'Optional';amount:number|null;sourceAmount:number|null;note:string;month:CashMonth|null;selected:boolean;earliestMonth:string|null;scenario:boolean}
export function cashFlowSources(data:FinancialData,input:CashFlowInput=emptyCashFlow()){
 validCashFlow(input)
 const monthly=(scope:'personal'|'business')=>data[scope].filter(r=>fundingRow(data,r)?.component==='monthly'||!fundingRow(data,r)&&financialNote(r).monthlyZar!==null)
 const personal=monthly('personal'),business=monthly('business'),coreBusiness=business.filter(r=>fundingRow(data,r)?.treatment==='essential-business'||!fundingRow(data,r))
 const personalDetail=personal.reduce((s,r)=>s+(sourceMinor(financialNote(r).monthlyZar)??0),0),businessMonthly=coreBusiness.reduce((s,r)=>s+(sourceMinor(financialNote(r).monthlyZar)??0),0)
 const household=data.funding?.household.minimumMonthlyMinor??personalDetail
 const expenses:CashExpense[]=(['personal','business'] as const).flatMap(scope=>data[scope].filter(r=>!monthly(scope).includes(r)).map(r=>{
  const n=financialNote(r),meta=fundingRow(data,r),scenario=data.funding?.cashFlowScenarios?.entries.find(e=>e.recordId===r.id),allocation=input.allocations[r.id],optional=n.optionalHardware
  return {id:r.id,label:scenario?.label??String(r.payload.label),scope:scope==='personal'?'Personal' as const:'Business' as const,category:optional?'CAPEX' as const:'One-off' as const,priority:optional?'Optional' as const:['Priority','Safety-critical','Medical review required'].includes(meta?.urgency??'')?'Urgent' as const:'Planned' as const,amount:scenario?.amountMinor??sourceMinor(n.oneOffZar),sourceAmount:sourceMinor(n.oneOffZar),note:scenario?.note??meta?.note??n.note,month:allocation?.month??null,selected:allocation?.selected??(!optional&&!scenario),earliestMonth:scenario?.earliestMonth??null,scenario:!!scenario}
 }))
 if(Object.keys(input.allocations).some(id=>!expenses.some(e=>e.id===id)))throw Error('Unknown expense allocation')
 if(expenses.some(e=>e.month&&e.earliestMonth&&e.month<e.earliestMonth))throw Error('Payment month precedes the owner scenario')
 return {personal,business,coreBusiness,household,personalDetail,businessMonthly,monthlyOpex:household+businessMonthly,expenses}
}
const sum=(values:(number|null)[])=>values.some(v=>v===null)?null:values.reduce<number>((s,v)=>s+v!,0)
export const cashFlowRowLabels=['Personal income','Business income','Total income','Household monthly OPEX','Business monthly OPEX','Personal once-offs','Business once-offs','Optional CAPEX','Total expenses','Net cash flow before funding','External funding injected','Opening cash balance','Closing cash balance','Outstanding funding requirement']
export function calculateCashFlow(data:FinancialData,input:CashFlowInput){
 const source=cashFlowSources(data,input);let opening=input.openingCash
 const rows=cashFlowMonths.map((month,i)=>{const selected=source.expenses.filter(e=>e.selected&&e.month===month),personalIncome=input.zeroIncome?0:input.personalIncome[i],businessIncome=input.zeroIncome?0:input.businessIncome[i],income=sum([personalIncome,businessIncome]),personalOnce=sum(selected.filter(e=>e.scope==='Personal'&&e.category==='One-off').map(e=>e.amount)),businessOnce=sum(selected.filter(e=>e.scope==='Business'&&e.category==='One-off').map(e=>e.amount)),capex=sum(selected.filter(e=>e.category==='CAPEX').map(e=>e.amount)),expenses=sum([source.household,source.businessMonthly,personalOnce,businessOnce,capex]),net=income===null||expenses===null?null:income-expenses,funding=input.funding[i],closing=sum([opening,net,funding]),gap=closing===null?null:Math.max(0,-closing),values=[personalIncome,businessIncome,income,source.household,source.businessMonthly,personalOnce,businessOnce,capex,expenses,net,funding,opening,closing,gap];opening=closing;return {month,values}})
 const period=cashFlowRowLabels.map((_,i)=>i===11?rows[0].values[i]:i===12?rows[4].values[i]:i===13?rows.some(r=>r.values[i]===null)?null:Math.max(...rows.map(r=>r.values[i]!)):sum(rows.map(r=>r.values[i])))
 const unscheduled=source.expenses.filter(e=>e.selected&&!e.month),knownUnscheduled=unscheduled.reduce((s,e)=>s+(e.amount??0),0),unknownUnscheduled=unscheduled.filter(e=>e.amount===null).length,urgent=source.expenses.filter(e=>e.selected&&e.priority==='Urgent')
 return {...source,rows,period,unscheduled,knownUnscheduled,unknownUnscheduled,urgentKnown:urgent.reduce((s,e)=>s+(e.amount??0),0),urgentUnknown:urgent.filter(e=>e.amount===null).length,fundingGap:period[13],zeroIncomeKnownNeeds:source.monthlyOpex*5+source.expenses.filter(e=>e.selected).reduce((s,e)=>s+(e.amount??0),0)}
}
