import { describe,it,expect } from 'vitest'
import { repaymentSchedule,type RepaymentTerms } from './repayment'
import { financialScenarios,emptySustainable,validSustainable } from './financialScenarios'
import type { ContentRecord } from '../../content-migration/ingestion-schema'
function fixtureRow(id:string,monthly:string|null,once:string|null,optional=false):ContentRecord{return {id,kind:'financial',classification:'BRUCE_PRIVATE',approval:'draft',verification:'awaiting-verification',file:null,provenance:{originalFilename:'synthetic.xlsx',sourceDate:null,citation:'Synthetic only',sourceReference:'synthetic',reviewedBy:null,reviewedOn:null,conflictNote:null},payload:{label:id,kind:'operating-cost',basis:'assumption',currency:'ZAR',amountMinor:Math.round((Number(monthly)*5+Number(once))*100),periodStart:null,periodEnd:null,reconciliationNote:JSON.stringify({monthlyZar:monthly,oneOffZar:once,optionalHardware:optional})}}}
const terms:RepaymentTerms={principal:12000,annualPercent:12,months:12,graceMonths:0,monthlyPayment:null,lumpSum:0,lumpMonth:1,startDate:'2026-01-31',mode:'fixed',realisedIncome:null,availableCash:null,incomeRoute:'jb3',commercialAgreement:false}
describe('repayment scenarios',()=>{
 it('reconciles interest, payments and principal without a forecast',()=>{const r=repaymentSchedule(terms)!;expect(r.outstanding).toBeLessThan(.01);expect(r.totalPaid).toBeCloseTo(r.principal+r.totalInterest,6);expect(r.rows[0].date).toBe('2026-02-28')})
 it('capitalises grace interest explicitly and retains no grace payments',()=>{const r=repaymentSchedule({...terms,graceMonths:2})!;expect(r.rows[0].payment).toBe(0);expect(r.rows[1].balance).toBeCloseTo(12000*1.01**2,6);expect(r.rows[2].date).toBe('2026-04-30');expect(r.totalInterest).toBeGreaterThan(repaymentSchedule(terms)!.totalInterest)})
 it('reports underpayment and growing balance',()=>{const r=repaymentSchedule({...terms,monthlyPayment:50})!;expect(r.shortfall).toBe(true);expect(r.negativeAmortisation).toBe(true);expect(r.outstanding).toBeGreaterThan(terms.principal)})
 it('reduces interest with early repayment',()=>{const r=repaymentSchedule({...terms,lumpSum:3000,lumpMonth:3})!;expect(r.totalInterest).toBeLessThan(repaymentSchedule(terms)!.totalInterest);expect(r.rows.length).toBeLessThan(12)})
 it('requires actual income and available cash and caps payments by both',()=>{expect(repaymentSchedule({...terms,mode:'cash-flow'})).toBeNull();const r=repaymentSchedule({...terms,mode:'cash-flow',realisedIncome:500,availableCash:300})!;expect(r.monthlyPayment).toBe(300);expect(r.shortfall).toBe(true)})
 it('does not make a personal bridge loan a corporate liability',()=>{const r={...terms,mode:'cash-flow' as const,realisedIncome:2000,availableCash:2000,incomeRoute:'beobacht' as const};expect(repaymentSchedule(r)).toBeNull();expect(repaymentSchedule({...r,commercialAgreement:true})).not.toBeNull()})
 it('rejects impossible dates and terms',()=>{expect(repaymentSchedule({...terms,startDate:'2026-02-31'})).toBeNull();expect(repaymentSchedule({...terms,graceMonths:-1})).toBeNull()})
})
describe('independent sustainable scenario',()=>{
 const data={personal:[fixtureRow('p','10','20')],business:[fixtureRow('b','5',null),fixtureRow('h',null,'50',true)],exchangeRate:null,findings:[]}
 it('does not invent a salary or treat missing inputs as zero',()=>{expect(financialScenarios(data).sustainableMinor).toBeNull();expect(financialScenarios(data,{...emptySustainable,basis:'salary'}).sustainableMinor).toBeNull()})
 it('replaces recurring personal minimum without double counting one-offs',()=>{const before=JSON.stringify(data);const r=financialScenarios(data,{...emptySustainable,food:10,health:5,transport:3,other:2});expect(r.minimumMinor).toBe(9500);expect(r.sustainableMinor).toBe(14500);expect(JSON.stringify(data)).toBe(before)})
 it('validates user comparison inputs and rejects extra selectors',()=>{expect(()=>validSustainable({...emptySustainable,salary:-1})).toThrow();expect(()=>validSustainable({...emptySustainable,path:'/private'})).toThrow()})
})
