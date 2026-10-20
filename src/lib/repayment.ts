/** Illustrative reducing-balance loan only; no source financial records are changed. */
export function illustrativeRepayment(principal: number, annualPercent: number, months: number) {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 100_000_000 || !Number.isFinite(annualPercent) || annualPercent < 0 || annualPercent > 100 || !Number.isInteger(months) || months < 1 || months > 600) return null
  const monthlyRate = annualPercent / 1200
  const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate))
  const total = monthlyRate === 0 ? principal : Math.max(principal, payment * months)
  return { principal, monthlyPayment: payment, totalInterest: total - principal, totalRepayment: total }
}

export interface RepaymentTerms { principal:number; annualPercent:number; months:number; graceMonths:number; monthlyPayment:number|null; lumpSum:number; lumpMonth:number; startDate:string; mode:'fixed'|'cash-flow'; realisedIncome:number|null; availableCash:number|null; incomeRoute:'jb3'|'beobacht'; commercialAgreement:boolean }
export function repaymentSchedule(input: RepaymentTerms) {
  const base = illustrativeRepayment(input.principal,input.annualPercent,input.months)
  if (!base || !Number.isInteger(input.graceMonths) || input.graceMonths<0 || input.graceMonths>60 || !Number.isFinite(input.lumpSum) || input.lumpSum<0 || !Number.isInteger(input.lumpMonth) || input.lumpMonth<1 || input.lumpMonth>input.months || (input.monthlyPayment!==null && (!Number.isFinite(input.monthlyPayment)||input.monthlyPayment<0))) return null
  if (input.mode==='cash-flow' && ([input.realisedIncome,input.availableCash].some(v=>v===null||!Number.isFinite(v)||v!<0) || input.incomeRoute==='beobacht'&&!input.commercialAgreement)) return null
  if (input.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)||!Number.isFinite(Date.parse(input.startDate))||new Date(input.startDate).toISOString().slice(0,10)!==input.startDate)) return null
  const rate=input.annualPercent/1200, postGrace=input.principal*(1+rate)**input.graceMonths
  const instalment=illustrativeRepayment(postGrace,input.annualPercent,input.months)!.monthlyPayment
  const desired=input.monthlyPayment??instalment
  const payment=input.mode==='cash-flow'?Math.min(desired,input.realisedIncome!,input.availableCash!):desired
  let balance=input.principal,totalInterest=0,totalPaid=0
  const rows=[]
  for(let index=1;index<=input.graceMonths+input.months && balance>.000001;index++) {
    const opening=balance,interest=opening*rate,repayIndex=index-input.graceMonths
    const regular=repayIndex>0?Math.min(payment,opening+interest):0
    const lump=repayIndex===input.lumpMonth?Math.min(input.lumpSum,opening+interest-regular):0
    balance=Math.max(0,opening+interest-regular-lump);totalInterest+=interest;totalPaid+=regular+lump
    let date=''
    if(input.startDate){const start=new Date(input.startDate+'T00:00:00Z'),year=start.getUTCFullYear(),month=start.getUTCMonth()+index;const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();date=new Date(Date.UTC(year,month,Math.min(start.getUTCDate(),last))).toISOString().slice(0,10)}
    rows.push({month:index,date,opening,interest,payment:regular,lump,balance,grace:repayIndex<=0})
  }
  return { principal:input.principal,monthlyPayment:payment,indicativeInstalment:instalment,totalInterest,totalRepayment:input.principal+totalInterest,totalPaid,outstanding:balance,shortfall:balance>.01,negativeAmortisation:rows.some(row=>!row.grace&&row.payment+row.lump<row.interest),rows }
}
