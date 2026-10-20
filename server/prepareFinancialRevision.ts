import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { loadLocalReview } from './localReview.ts'
import { createFinancialWorkbook } from './financialExport.ts'
import { financialNote, totals, validateFinancialRows } from '../src/lib/financialSchedules.ts'
/** Explicit owner operation only, never exposed through an HTTP route. Originals are immutable. */
export async function prepareFinancialRevision(root: string, instruction: string, input: { owner: string; recordedOn: string; transportMonthlyZar: number; therapySessionZar: number; sessionsPerMonth: number; fortnightlySessionsPerYear: number }) {
  if ([input.transportMonthlyZar,input.therapySessionZar,input.sessionsPerMonth,input.fortnightlySessionsPerYear].some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Owner budget inputs required')
  const folder = path.join(root,'financial-canonical'), target = path.join(folder,'financial-revision.json')
  try { await access(target); throw new Error('Existing canonical revision must be reviewed before replacement') } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const { data } = await loadLocalReview(root), original = data.finances
  const personal = structuredClone(original.personal), business = structuredClone(original.business)
  const transport = personal.filter(row => /school.*petrol|family.*petrol/i.test(String(row.payload.label)))
  if (transport.length !== 1) throw new Error('Unique historical transport row required')
  const row = transport[0], oldNote = financialNote(row), oldAmount = row.payload.amountMinor
  row.payload.amountMinor = Math.round(input.transportMonthlyZar * 100) * 5
  row.payload.reconciliationNote = JSON.stringify({ ...oldNote, monthlyZar: String(input.transportMonthlyZar), note: `${oldNote.note}. Owner-adjusted monthly budget; original source estimate preserved in historical snapshot.`, ownerAdjustment: { owner: input.owner, date: input.recordedOn, previousMonthlyZar: oldNote.monthlyZar, revisedMonthlyZar: input.transportMonthlyZar, previousAmountMinor: oldAmount } })
  const food = personal.find(row => /household food/i.test(String(row.payload.label)))
  if (food) food.payload.reconciliationNote = JSON.stringify({ ...financialNote(food), note: `${financialNote(food).note}. Minimum survival allowance only, not an ideal or fully sustainable household food budget.` })
  await mkdir(folder,{recursive:true})
  const sourceName = 'owner-budget-instruction.txt', sourceBytes = await readFile(instruction)
  await copyFile(instruction,path.join(folder,sourceName))
  const digest = (bytes: Buffer|string) => createHash('sha256').update(bytes).digest('hex')
  const therapyMonthly = input.therapySessionZar * input.sessionsPerMonth
  personal.push({ id: randomUUID(), kind:'financial', classification:'BRUCE_PRIVATE', approval:'draft', verification:'awaiting-verification', provenance:{ originalFilename:sourceName, sourceDate:input.recordedOn, citation:'Owner-approved transport and minimum therapy budget adjustment; not an invoice or agreed loan', sourceReference:`sha256:${digest(sourceBytes)}`, reviewedBy:input.owner, reviewedOn:input.recordedOn, conflictNote:null }, payload:{ label:'Therapy / counselling',kind:'funding-need',basis:'assumption',currency:'ZAR',amountMinor:Math.round(therapyMonthly*100)*5,periodStart:row.payload.periodStart,periodEnd:row.payload.periodEnd,reconciliationNote:JSON.stringify({ schedule:'Personal',monthlyZar:String(therapyMonthly),oneOffZar:null,formula:`${input.therapySessionZar}*${input.sessionsPerMonth}*5`,cachedTotalZar:String(therapyMonthly*5),note:'Owner budget allowance; provider quote and actual appointments remain to be confirmed. Optional fortnightly average is separate from this minimum.',missingInputs:false,optionalHardware:false,periodBasis:oldNote.periodBasis,amountBasis:'Owner-approved budget adjustment; provisional expense, not an approved obligation',ownerAdjustment:input }) },file:null })
  validateFinancialRows([...personal,...business])
  const active = { ...original, personal, business }
  const bytes = await createFinancialWorkbook(active,'combined',original.exchangeRate!.zarPerGbp)
  const workbookName = 'JB3_Personal_Business_Canonical_v2.xlsx'
  await writeFile(path.join(folder,workbookName),bytes,{mode:0o600})
  await writeFile(path.join(folder,'historical-financial-records.json'),JSON.stringify({personal:original.personal,business:original.business},null,2),{mode:0o600})
  const revision = { format:'JB3_FINANCIAL_REVISION_V1',classification:'BRUCE_PRIVATE',approval:'draft',owner:input.owner,recordedOn:input.recordedOn,historicalRecordsSha256:digest(JSON.stringify({personal:original.personal,business:original.business})),ownerInstruction:{relativePath:`financial-canonical/${sourceName}`,sha256:digest(sourceBytes)},workbook:{relativePath:`financial-canonical/${workbookName}`,sha256:digest(bytes)},personal,business,therapy:{sessionZar:input.therapySessionZar,sessionsPerMonth:input.sessionsPerMonth,fortnightlyAverageMonthlyZar:input.therapySessionZar*input.fortnightlySessionsPerYear/12},disclosure:'Minimum stabilisation budget only; not a final loan request. Unknowns remain excluded. Sustainable allowance, eligibility, funding structure and repayment terms require agreement.' }
  await writeFile(target,JSON.stringify(revision,null,2)+'\n',{mode:0o600})
  return { personal:totals(personal).baseline/100,business:totals(business).baseline/100,combined:(totals(personal).baseline+totals(business).baseline)/100,optional:totals(business).optional/100,includingOptional:(totals(personal).known+totals(business).known)/100,rows:personal.length+business.length,unknowns:totals([...personal,...business]).unresolved }
}
