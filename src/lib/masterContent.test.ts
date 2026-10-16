import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { blankManifest, type ContentRecord } from '../../content-migration/ingestion-schema'
import { parseMaster, parseMasterIntake, canonicalPresentation, masterPrintHtml, type ApprovedMaster, type MasterIntake } from '../../content-migration/master-content'
import { parseManifest } from '../../content-migration/ingestion-schema'
import { stageLocal } from '../../content-migration/local-importer'
import { assertPublicModule } from '../../content-migration/build-boundary'
import { demoSections } from '../content/registry'

const body = 'Synthetic only: JB³ — £ <script>window.bad=true</script>\n\n  Preserve spacing.\r\nDo not summarise.'
function narrative(): ContentRecord {
  return { id: randomUUID(), kind: 'narrative', classification: 'BRUCE_PRIVATE', verification: 'reported', approval: 'approved', provenance: { originalFilename: 'synthetic.txt', sourceDate: null, citation: 'Synthetic fixture', sourceReference: 'fixture', reviewedBy: 'Test', reviewedOn: '2026-10-14', conflictNote: null }, payload: { heading: 'Synthetic heading', body }, file: null }
}
function fixture(): ApprovedMaster {
  const content = blankManifest()
  content.sections.forEach(s => s.records.push(narrative()))
  return { format: 'JB3_APPROVED_MASTER_V1', content, laboratoryShowcase: null, financialSchedules: { personal: [], business: [] }, exchangeRate: null }
}
function financial(master: ApprovedMaster) {
  const r = narrative(); r.kind = 'financial'
  r.payload = { label: 'Synthetic cost', kind: 'operating-cost', basis: 'reported', amountMinor: 25000, currency: 'ZAR', periodStart: '2026-10-01', periodEnd: '2026-10-31', reconciliationNote: null }
  master.content.sections[8].records.push(r)
  master.financialSchedules.personal.push(r.id)
  master.exchangeRate = { zarPerGbp: 25, asOf: '2026-10-14', source: 'Synthetic test assumption only', approvedBy: 'Test', approvedOn: '2026-10-14' }
  return r
}
describe('approved master integration', () => {
  it('validates review-only drafts without promoting missing dates, amounts or FX approval', () => {
    const m = fixture(), r = financial(m)
    r.approval = 'draft'; r.payload.periodStart = null; r.payload.periodEnd = null; r.payload.amountMinor = null
    for (const index of [4, 7, 10]) m.content.sections[index].records[0].approval = 'draft'
    const intake: MasterIntake = { ...m, format: 'JB3_MASTER_INTAKE_V1', exchangeRate: { ...m.exchangeRate!, asOf: null, approvedBy: null, approvedOn: null } }
    expect(parseMasterIntake(intake).content.sections[4].records[0].approval).toBe('draft')
    expect(() => parseMaster(intake)).toThrow(/format/)
    expect(() => parseMaster({ ...intake, format: 'JB3_APPROVED_MASTER_V1' })).toThrow(/approved/)
    r.approval = 'approved'; r.payload.amountMinor = 100
    expect(() => parseManifest(m.content)).toThrow(/financial metadata/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('src/App.tsx'), 'JB3_MASTER_INTAKE_V1')).toThrow(/Private manifest/)
  })
  it('blocks review-only staging before creating any batch or PDF', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'jb3-review-test-'))
    try {
      const m = fixture(); m.content.sections[7].records[0].approval = 'draft'
      const intake: MasterIntake = { ...m, format: 'JB3_MASTER_INTAKE_V1' }
      await writeFile(path.join(root, 'master-intake.json'), JSON.stringify(intake))
      await expect(stageLocal(root, 'master-intake.json')).rejects.toThrow(/Review-only/)
      await expect(readFile(path.join(root, 'batches'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it('accepts original filenames with parentheses while retaining path traversal rejection', () => {
    const m = fixture(), r = narrative(); r.kind = 'photograph'; r.approval = 'draft'; r.payload = { caption: 'Synthetic filename only', alt: 'Test' }
    r.file = { relativePath: 'sources/test (1).jpeg', sha256: 'a'.repeat(64), mimeType: 'image/jpeg' }
    m.content.sections[2].records.push(r)
    expect(parseManifest(m.content)).toBe(m.content)
    r.file.relativePath = 'sources/../test (1).jpeg'
    expect(() => parseManifest(m.content)).toThrow(/safe relative/)
  })
  it('maps to the unchanged registry and preserves exact narrative strings', () => {
    const m = fixture(); const view = canonicalPresentation(m)
    expect(view.blocks.map(b => b.id)).toEqual(demoSections.map(s => s.id))
    expect(view.blocks.every(b => b.records[0].payload.body === body)).toBe(true)
    expect(masterPrintHtml(m)).not.toContain('<script>')
    expect(masterPrintHtml(m)).toContain('&lt;script&gt;')
  })
  it('keeps an optional unnumbered showcase between 03 and 04 without duplicating evidence', () => {
    const m = fixture(), r = narrative(); m.content.sections[2].records.push(r)
    m.laboratoryShowcase = { title: '23-Day Laboratory Showcase', recordIds: [r.id] }
    const blocks = canonicalPresentation(m).blocks
    expect(blocks.map(b => b.number)).toEqual([1, 2, 3, null, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(blocks[3].records).toEqual([r]); expect(blocks[2].records).not.toContain(r)
    m.laboratoryShowcase.recordIds = [m.content.sections[0].records[0].id]
    expect(() => parseMaster(m)).toThrow(/Section 03/)
  })
  it('separates schedules and converts both currency directions with an explicit assumption', () => {
    const m = fixture(), r = financial(m)
    expect(canonicalPresentation(m).financialSchedules.personal[0].display).toBe('ZAR 250.00 / GBP 10.00')
    expect(canonicalPresentation(m).financialSchedules.business).toEqual([])
    r.payload.currency = 'GBP'; r.payload.amountMinor = 1000
    expect(canonicalPresentation(m).financialSchedules.personal[0].zarMinor).toBe(25000)
    m.financialSchedules.business.push(r.id)
    expect(() => parseMaster(m)).toThrow(/duplicate/)
    m.financialSchedules.business = []; m.exchangeRate = null
    expect(() => parseMaster(m)).toThrow(/exchange-rate/)
  })
  it('rejects missing narratives, unapproved records, unassigned finances and master public imports', () => {
    const m = fixture(); m.content.sections[0].records = []
    expect(() => parseMaster(m)).toThrow(/eleven/)
    const n = fixture(); n.content.sections[0].records[0].approval = 'draft'
    expect(() => parseMaster(n)).toThrow(/approved/)
    const f = fixture(); financial(f); f.financialSchedules.personal = []
    expect(() => parseMaster(f)).toThrow(/schedule/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('src/App.tsx'), 'JB3_APPROVED_MASTER_V1')).toThrow(/Private manifest/)
  })
  it('creates matching canonical private data and an offline PDF, preserving metadata and closed release', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'jb3-master-test-'))
    try {
      const m = fixture(); financial(m)
      await writeFile(path.join(root, 'approved-master.json'), JSON.stringify(m))
      const result = await stageLocal(root, 'approved-master.json')
      const batchRoot = path.join(root, 'batches', result.batchId)
      const view = JSON.parse(await readFile(path.join(batchRoot, 'presentation.json'), 'utf8'))
      expect(view).toEqual(canonicalPresentation(m))
      expect(view.blocks[0].records[0].provenance).toEqual(m.content.sections[0].records[0].provenance)
      expect((await readFile(path.join(batchRoot, 'investor-presentation.pdf'))).subarray(0, 5).toString()).toBe('%PDF-')
      const batch = JSON.parse(await readFile(path.join(batchRoot, 'batch.json'), 'utf8'))
      expect(batch.releaseEnabled).toBe(false); expect(batch.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    } finally { await rm(root, { recursive: true, force: true }) }
  }, 60000)
})
