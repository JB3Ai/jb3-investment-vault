import {presentationText} from '../src/lib/presentationCopy.ts'
import { applyFundingWorkbook } from './fundingWorkbook.ts'
import { orderedFinancialRows, fundingSummary } from '../src/lib/fundingProposal.ts'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { chmod, mkdtemp, readFile, rmdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IncomingMessage } from 'node:http'
import { financialNote, planningMonths, sourceMinor, validExchangeRate, validateFinancialRows, type ExportScope, type FinancialData } from '../src/lib/financialSchedules.ts'
import { emptySustainable, financialScenarios, validSustainable, type SustainableInput } from '../src/lib/financialScenarios.ts'

/** Local Node runtime only. This module is never imported by the frontend or Worker. */
export async function workbookRuntime() {
  const runtime = process.env.JB3_WORKBOOK_RUNTIME ?? path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')
  const resolve = createRequire(path.join(runtime, 'package.json'))
  return import(/* @vite-ignore */ pathToFileURL(resolve.resolve('@oai/artifact-tool')).href)
}
export function exportRequest(value: unknown): { scope: ExportScope; zarPerGbp: number; scenario?: SustainableInput } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid export request')
  const data = value as Record<string, unknown>
  if (!['scope,zarPerGbp','scenario,scope,zarPerGbp'].includes(Object.keys(data).sort().join(',')) || !['combined', 'personal', 'business'].includes(String(data.scope)) || typeof data.zarPerGbp !== 'number' || !validExchangeRate(data.zarPerGbp)) throw new Error('Invalid export request')
  return { scope: data.scope as ExportScope, zarPerGbp: data.zarPerGbp, ...(Object.hasOwn(data,'scenario')?{scenario:validSustainable(data.scenario)}:{}) }
}
export async function readExportRequest(request: IncomingMessage) {
  if (request.headers['content-type'] !== 'application/json') throw new Error('JSON required')
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk)
    if (size > 1024) throw new Error('Export request too large')
    chunks.push(Buffer.from(chunk))
  }
  return exportRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')))
}
const literal = (value: unknown) => {
  const text = value === null || value === undefined ? 'Not supplied' : String(value)
  return /^[=+@-]/.test(text) ? `'${text}` : text
}

/** Fresh workbook per request; no shared cache or retained export files. */
export async function createFinancialWorkbook(data: FinancialData, scope: ExportScope, rate: number, scenario: SustainableInput = emptySustainable, canonical = false) {
  exportRequest({ scope, zarPerGbp: rate })
  const schedules = scope === 'combined' ? ['personal', 'business'] as const : [scope]
  const selected = schedules.flatMap(name => data[name])
  validateFinancialRows(selected)
  const { Workbook, SpreadsheetFile } = await workbookRuntime()
  const wb = Workbook.create()
  const summary = wb.worksheets.add('Summary'), assumptions = wb.worksheets.add('Assumptions')
  const sheets = schedules.map(name => ({ name, title: name === 'personal' ? 'Personal' : 'Business', sheet: wb.worksheets.add(name === 'personal' ? 'Personal' : 'Business') }))
  const sources = wb.worksheets.add('Source notes')
  const comparison = wb.worksheets.add('Budget scenarios')
  validSustainable(scenario)
  assumptions.getRange('A2:B11').values = [
    ['Exchange rate (ZAR per GBP)', rate], ['Planning months', planningMonths],
    ['Rate source', literal(data.exchangeRate?.source??'Awaiting source confirmation')], ['Rate date', literal(data.exchangeRate?.asOf??'Awaiting dated assumption')],
    ['Rate status', 'Editable review assumption; not approved. Selected in local preview.'],
    ['Personal horizon', 'October 2026 to February 2027'], ['Business horizon', 'Five months; calendar dates awaiting confirmation'],
    ['Exclusions', 'Unknown amounts excluded; optional hardware excluded from baseline. No agreed loan principal.'],
    ['Approval', 'BRUCE_PRIVATE / DRAFT / OWNER REVIEW ONLY'],
    ['Blank source inputs', 'Blank amounts are unresolved or not applicable; see the row status. They are never confirmed zero.'],
  ]
  assumptions.getRange('B2:B3').format.fill = '#FFF1CA'
  assumptions.getRange('B2').setNumberFormat('0.0000')
  if(data.revision&&scope!=='business'){
    assumptions.getRange('A16:B21').values=[['Therapy session allowance ZAR',data.revision.therapy.sessionZar],['Minimum sessions per month',data.revision.therapy.sessionsPerMonth],['Minimum therapy monthly ZAR',null],['Optional fortnightly sessions per year',26],['Optional average monthly ZAR',null],['Therapy status','Owner budget assumption; optional fortnightly average excluded from baseline; quote and need remain to confirm.']]
    assumptions.getRange('B18').formulas=[['=B16*B17']];assumptions.getRange('B20').formulas=[['=B16*B19/12']]
  }
  const sourceRows: (string | number | null)[][] = []
  const summaryRows: { title: string; sheet: string; row: number }[] = []
  for (const { name, title, sheet } of sheets) {
    const rows = orderedFinancialRows(data,data[name]), last = rows.length + 4, totalRow = last + 2
    sheet.getRange('A2').values = [[`${title} expenditure: indicative draft`]]
    sheet.getRange('A4:G4').values = [['Purpose', 'One-off ZAR', 'Monthly ZAR', 'Five-month ZAR', 'Indicative GBP', 'Funding category', 'Approval / verification']]
    sheet.getRange(`A5:G${last}`).values = rows.map(record => {
      const note = financialNote(record)
      const monthly = sourceMinor(note.monthlyZar), once = sourceMinor(note.oneOffZar)
      return [literal(presentationText(String(record.payload.label))), once === null ? null : once / 100, monthly === null ? null : monthly / 100, null, null, note.optionalHardware ? 'Optional hardware' : 'Baseline', `${record.approval} / ${record.verification}${record.payload.amountMinor === null ? ' / AMOUNT UNKNOWN' : ''}`]
    })
    rows.forEach((record, index) => {
      const row = index + 5, note = financialNote(record)
      if(data.revision&&scope!=='business'&&/therapy.*counselling/i.test(String(record.payload.label)))sheet.getRange(`C${row}`).formulas=[['=Assumptions!$B$18']]
      // Unknown source rows stay blank, instead of the original workbook's cached zero.
      sheet.getRange(`D${row}:E${row}`).formulas = [[`=IF(COUNT(B${row}:C${row})=0,"",ROUND((N(C${row})*Assumptions!$B$3+N(B${row})),2))`, `=IF(ISNUMBER(D${row}),ROUND(D${row}/Assumptions!$B$2,2),"")`]]
      sourceRows.push([record.id, title, literal(record.payload.label), record.classification, record.approval, record.verification, literal(record.provenance.originalFilename), literal(record.provenance.sourceDate), literal(record.provenance.citation), literal(record.provenance.sourceReference), literal(note.formula), literal(note.cachedTotalZar), literal(note.note), literal(note.periodBasis), literal(note.amountBasis), record.payload.amountMinor === null ? 'UNKNOWN; excluded from known subtotal' : 'Known source estimate; unverified', literal(record.provenance.reviewedBy), literal(record.provenance.reviewedOn), literal(record.provenance.conflictNote), JSON.stringify(record)])
    })
    sheet.getRange(`A${totalRow}:A${totalRow + 3}`).values = [['Known baseline (excludes optional)'], ['Optional hardware'], ['Known total including optional'], ['Unresolved rows excluded']]
    sheet.getRange(`D${totalRow}:E${totalRow + 3}`).formulas = [
      [`=SUMIF(F5:F${last},"Baseline",D5:D${last})`, `=ROUND(D${totalRow}/Assumptions!$B$2,2)`],
      [`=SUMIF(F5:F${last},"Optional hardware",D5:D${last})`, `=ROUND(D${totalRow + 1}/Assumptions!$B$2,2)`],
      [`=SUM(D5:D${last})`, `=ROUND(D${totalRow + 2}/Assumptions!$B$2,2)`],
      [`=ROWS(D5:D${last})-COUNT(D5:D${last})`, '="Not valued"'],
    ]
    sheet.getRange(`B5:C${last}`).format.font.color = '#24613F'
    sheet.getRange(`B5:E${totalRow + 2}`).setNumberFormat('#,##0.00;(#,##0.00);0.00')
    sheet.getRange(`A${totalRow}:G${totalRow + 3}`).format.fill = '#EEE9DF'
    sheet.getRange('A1:A40').format.columnWidth = 52
    sheet.getRange('B1:E40').format.columnWidth = 19
    sheet.getRange('F1:F40').format.columnWidth = 23
    sheet.getRange('G1:G40').format.columnWidth = 52
    sheet.freezePanes.freezeRows(4)
    summaryRows.push({ title, sheet: title, row: totalRow })
  }
  summary.getRange('A2').values = [['JB³ private financial schedules']]
  summary.getRange('A3').values = [['BRUCE_PRIVATE • DRAFT • indicative known inputs, not an agreed funding obligation']]
  summary.getRange('A5:D5').values = [['Schedule', 'Baseline ZAR', 'Optional hardware ZAR', 'Unresolved rows']]
  summaryRows.forEach((item, index) => {
    const row = index + 6
    summary.getRange(`A${row}`).values = [[item.title]]
    summary.getRange(`B${row}:D${row}`).formulas = [[`='${item.sheet}'!D${item.row}`, `='${item.sheet}'!D${item.row + 1}`, `='${item.sheet}'!D${item.row + 3}`]]
  })
  const end = 5 + summaryRows.length
  summary.getRange('A10:C13').values = [[scope === 'combined' ? 'Combined indicative baseline' : 'Indicative baseline', null, null], ['Optional hardware: separate decision', null, null], ['Known total including optional', null, null], ['Unknown amounts excluded', null, 'Not valued']]
  summary.getRange('B10:C13').formulas = [[`=SUM(B6:B${end})`, '=ROUND(B10/Assumptions!$B$2,2)'], [`=SUM(C6:C${end})`, '=ROUND(B11/Assumptions!$B$2,2)'], ['=SUM(B10:B11)', '=ROUND(B12/Assumptions!$B$2,2)'], [`=SUM(D6:D${end})`, '="Not valued"']]
  summary.getRange('B9:C9').values = [['ZAR', 'GBP (indicative)']]
  summary.getRange('B6:C12').setNumberFormat('#,##0.00;(#,##0.00);0.00')
  summary.getRange('A15').values = [['Excludes unresolved amounts; optional hardware is not part of baseline operating needs.']]
  summary.getRange('A16').values = [['Personal and business calendar periods are not confirmed as aligned. No revenue assumed.']]
  summary.getRange('A17').values = [['Blank source components are not confirmed zero. Historical costs and permitted funding uses remain subject to review.']]
  sources.getRange('A2:T2').values = [['Record UUID', 'Schedule', 'Purpose', 'Classification', 'Approval', 'Verification', 'Original filename', 'Source date', 'Citation', 'Source hash/reference', 'Original source formula (literal)', 'Original cached total ZAR (literal)', 'Verification note', 'Period basis', 'Amount basis', 'Unresolved amount', 'Reviewer', 'Review date', 'Conflict note', 'Unchanged source record JSON']]
  sources.getRange(`A3:T${sourceRows.length + 2}`).values = sourceRows
  let findingRow = sourceRows.length + 5
  // A schedule-only export must not disclose records or findings from the other schedule.
  for (const finding of data.findings.filter(f => scope === 'combined' || new RegExp(scope, 'i').test(f.source))) {
    sources.getRange(`A${findingRow}:B${findingRow}`).values = [[literal(finding.source), literal(finding.note)]]; findingRow++
  }
  const scopedData={...data,personal:scope==='business'?[]:data.personal,business:scope==='personal'?[]:data.business}
  const exportedScenario=scope==='business'?emptySustainable:scenario
  const scenarioTotals=financialScenarios(scopedData,exportedScenario)
  comparison.getRange('A2:B13').values=[['Scenario comparison','DRAFT / REVIEWER INPUT'],['Minimum operating baseline ZAR',scenarioTotals.minimumMinor/100],['Sustainable basis',exportedScenario.basis],['Monthly food ZAR',exportedScenario.food],['Monthly health ZAR',exportedScenario.health],['Monthly transport ZAR',exportedScenario.transport],['Monthly other living ZAR',exportedScenario.other],['Monthly salary / consulting ZAR',exportedScenario.salary],['Known personal one-offs ZAR',scenarioTotals.oneOffMinor/100],['Business operating ZAR',scenarioTotals.businessMinor/100],['Sustainable five-month ZAR',null],['Sustainable GBP',null]]
  comparison.getRange('B12').formulas=[['=IF(B4="salary",IF(ISNUMBER(B9),B9*Assumptions!$B$3+B10+B11,"Owner input required"),IF(COUNT(B5:B8)=4,SUM(B5:B8)*Assumptions!$B$3+B10+B11,"Owner input required"))']]
  comparison.getRange('B13').formulas=[['=IF(ISNUMBER(B12),ROUND(B12/Assumptions!$B$2,2),"Owner input required")']]
  if(scope==='business')comparison.getRange('B12').formulas=[['=B11']]
  comparison.getRange('A15').values=[['Replaces personal monthly minimum; not added to it. Unknowns and optional hardware excluded. A single-schedule export uses only that schedule’s source rows.']]
  comparison.getRange('A16').values=[['Input estimates are illustrative and not approved salary, consulting or loan terms. Personal loan and commercial arrangements require formal documentation.']]
  comparison.getRange('A1:A17').format.columnWidth=48; comparison.getRange('B1:B17').format.columnWidth=48
  comparison.getRange('B5:B9').format.fill='#FFF1CA'
  if(data.revision){assumptions.getRange('A13:B14').values=[['Budget revision owner / date',`${data.revision.owner} / ${data.revision.recordedOn}`],['Canonical source',canonical?'This workbook; SHA-256 recorded in the private financial-revision.json ledger':`${data.revision.workbook} / sha256:${data.revision.workbookSha256}`]]}
  for (const sheet of [summary, assumptions, ...sheets.map(s => s.sheet), sources,comparison]) {
    sheet.showGridLines = false
    sheet.getUsedRange().format.font.name = 'Arial'
    sheet.getUsedRange().format.font.size = 10
    sheet.getUsedRange().format.rowHeight = 23
  }
  for (const { sheet } of sheets) sheet.getRange('A4:G4').format = { fill: '#292C29', font: { bold: true, color: '#FFFFFF' } }
  summary.getRange('A5:D5').format = { fill: '#292C29', font: { bold: true, color: '#FFFFFF' } }
  summary.getRange('A10:C12').format.fill = '#EEE9DF'
  summary.getRange('A1:A20').format.columnWidth = 54
  summary.getRange('B1:D20').format.columnWidth = 25
  assumptions.getRange('A1:A12').format.columnWidth = 30
  assumptions.getRange('B1:B12').format.columnWidth = 110
  sources.getUsedRange().format.columnWidth = 30
  sources.getRange('A2:T2').format = { fill: '#292C29', font: { bold: true, color: '#FFFFFF' } }
  sources.freezePanes.freezeRows(2)
  applyFundingWorkbook(wb,data,scope)
  wb.recalculate()
  const scopedFunding = fundingSummary({...data,personal:scope==='business'?[]:data.personal,business:scope==='personal'?[]:data.business})
  const expected = scopedFunding ? scopedFunding.knownRequirementsMinor/100 : selected.reduce((sum, r) => sum + (typeof r.payload.amountMinor === 'number' ? r.payload.amountMinor : 0), 0) / 100
  if (Math.abs(Number(summary.getRange('B12').values[0][0]) - expected) > 0.001) throw new Error('Workbook calculation failed reconciliation')
  const output = await SpreadsheetFile.exportXlsx(wb)
  // The runtime exposes save(), not an in-memory byte method. Use an isolated
  // owner-temp directory, outside the repo, then remove it before responding.
  const directory = await mkdtemp(path.join(tmpdir(), 'JB3Vault-export-'))
  const file = path.join(directory, 'private-draft.xlsx')
  try {
    await chmod(directory, 0o700)
    await output.save(file)
    await chmod(file, 0o600)
    return await readFile(file)
  } finally {
    // The runtime also writes an inspection sidecar. Both are test-owned,
    // exact paths in our unique directory; never use a recursive removal.
    for (const owned of [file, `${file}.inspect.ndjson`]) {
      await unlink(owned).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
    }
    await rmdir(directory)
  }
}
