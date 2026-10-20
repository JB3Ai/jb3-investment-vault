import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { privateFile } from '../content-migration/local-importer.ts'
import type { FinancialData } from '../src/lib/financialSchedules.ts'
import type { FundingProposal } from '../src/lib/fundingProposal.ts'

export function parseFundingProposal(value: unknown, data: FinancialData): FundingProposal {
  const p = value as FundingProposal
  const money = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 10000000000
  const rows = [...data.personal, ...data.business], ids = new Set(rows.map(row => row.id))
  if (!p || p.format !== 'JB3_FUNDING_PROPOSAL_V1' || p.classification !== 'BRUCE_PRIVATE' || p.approval !== 'draft' || typeof p.owner!=='string' || !p.owner.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.recordedOn) || !p.source?.originalFilename || !/^[a-f0-9]{64}$/.test(p.source.sha256) || !/^[a-f0-9]{64}$/.test(p.historicalRecordsSha256)) throw Error('Invalid private funding proposal')
  if (!p.household || ![p.household.essentialsMonthlyMinor,p.household.bufferMonthlyMinor,p.household.minimumMonthlyMinor].every(money) || p.household.minimumMonthlyMinor !== p.household.essentialsMonthlyMinor + p.household.bufferMonthlyMinor || p.household.minimumMonthlyMinor <= 0 || !Array.isArray(p.household.periods) || p.household.periods.length !== 5) throw Error('Household proposal does not reconcile')
  if(p.household.inclusions!==undefined&&(!Array.isArray(p.household.inclusions)||!p.household.inclusions.length||p.household.inclusions.some(v=>typeof v!=='string'||!v.trim())))throw Error('Invalid household inclusion note')
  let previous = -1
  for (const period of p.household.periods) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw Error('Invalid household period')
    const serial = Number(period.slice(0,4))*12 + Number(period.slice(5))
    if (previous !== -1 && serial !== previous + 1) throw Error('Household periods must be consecutive')
    previous = serial
  }
  if (!p.business || ![p.business.essentialMonthlyMinor,p.business.travelMonthlyMinMinor,p.business.travelMonthlyMaxMinor].every(money) || p.business.travelMonthlyMinMinor > p.business.travelMonthlyMaxMinor) throw Error('Invalid business proposal')
  if (!Array.isArray(p.rows) || p.rows.length !== rows.length || new Set(p.rows.map(row=>row.recordId)).size !== rows.length) throw Error('Every financial source row needs one funding treatment')
  for (const row of p.rows) {
    const personal = data.personal.some(record=>record.id===row.recordId)
    if(personal&&((row.treatment==='included-in-household'&&row.component!=='monthly')||(row.treatment==='additional-one-off'&&row.component!=='one-off')))throw Error('Household component classification mismatch')
    if (!ids.has(row.recordId) || !['one-off','monthly'].includes(row.component) || !['Confirmed','Awaiting reconciliation','Awaiting quote','Deferred'].includes(row.status) || !['Priority','Safety-critical','Medical review required','Essential','Standard','Staged'].includes(row.urgency) || typeof row.note!=='string' || !row.note.trim() || !(personal?['included-in-household','additional-one-off']:['essential-business','conditional-business','optional-hardware']).includes(row.treatment)) throw Error('Funding treatment does not match source schedule')
  }
  return p
}
export async function loadFundingProposal(root:string,data:FinancialData):Promise<FinancialData>{
  let value
  try{value=JSON.parse(await readFile(await privateFile(root,'financial-canonical/funding-proposal.json'),'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return data;throw error}
  const p=parseFundingProposal(value,data),hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex')
  if(hash(JSON.stringify({personal:data.personal,business:data.business}))!==p.historicalRecordsSha256 || hash(await readFile(await privateFile(root,p.source.relativePath)))!==p.source.sha256)throw Error('Funding proposal source changed; reconciliation required')
  return {...data,funding:p}
}
