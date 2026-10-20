import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { privateFile } from '../content-migration/local-importer.ts'
import { blankManifest, parseManifest } from '../content-migration/ingestion-schema.ts'
import { validateFinancialRows, type FinancialData } from '../src/lib/financialSchedules.ts'

export async function revisedFinances(root: string, original: FinancialData): Promise<FinancialData> {
  let revision
  try { revision = JSON.parse((await readFile(await privateFile(root, 'financial-canonical/financial-revision.json'))).toString('utf8')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return original; throw error }
  if (revision.format !== 'JB3_FINANCIAL_REVISION_V1' || revision.classification !== 'BRUCE_PRIVATE' || revision.approval !== 'draft' || !revision.owner || !revision.ownerInstruction || !revision.workbook) throw new Error('Invalid private financial revision')
  const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
  if (digest(JSON.stringify({ personal: original.personal, business: original.business })) !== revision.historicalRecordsSha256) throw new Error('Historical source changed; revision reconciliation required')
  for (const source of [revision.ownerInstruction, revision.workbook]) if (digest(await readFile(await privateFile(root, source.relativePath))) !== source.sha256) throw new Error('Canonical financial source hash mismatch')
  const manifest = blankManifest()
  manifest.sections[8].records = [...revision.personal, ...revision.business]
  parseManifest(manifest); validateFinancialRows(manifest.sections[8].records)
  const ids = new Set(manifest.sections[8].records.map(row => row.id))
  if ([...original.personal, ...original.business].some(row => !ids.has(row.id)) || JSON.stringify(original.business) !== JSON.stringify(revision.business)) throw new Error('Historical rows cannot be discarded or business costs silently changed')
  return { ...original, personal: revision.personal, business: revision.business, revision: { owner: revision.owner, recordedOn: revision.recordedOn, source: revision.ownerInstruction.relativePath, workbook: revision.workbook.relativePath, workbookSha256: revision.workbook.sha256, therapy: revision.therapy }, findings: [...original.findings, { source: 'Owner budget revision', note: revision.disclosure }] }
}
