import { describe, it, expect, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { blankManifest, parseManifest, type ContentRecord } from '../../content-migration/ingestion-schema'
import { validateLocal, stageLocal, privateRoot } from '../../content-migration/local-importer'
import { assertPublicAssets, assertPublicModule } from '../../content-migration/build-boundary'

const roots: string[] = []
async function root() { const p = await mkdtemp(path.join(os.tmpdir(), 'jb3-ingest-test-')); roots.push(p); return p }
afterAll(async () => { for (const p of roots) await rm(p, { recursive: true, force: true }) })
function record(): ContentRecord {
  return { id: '11111111-1111-4111-8111-111111111111', kind: 'narrative', classification: 'BRUCE_PRIVATE', verification: 'documented', approval: 'approved', provenance: { originalFilename: 'synthetic.txt', sourceDate: '2026-10-14', citation: 'Synthetic fixture page 1', sourceReference: 'synthetic-source', reviewedBy: 'Test reviewer', reviewedOn: '2026-10-14', conflictNote: null }, payload: { heading: 'Synthetic', body: 'Test only, not investor material' }, file: null }
}
describe('private ingestion boundary', () => {
  it('creates eleven empty sections, with release disabled', () => {
    expect(parseManifest(blankManifest()).sections).toHaveLength(11)
    expect(() => parseManifest({ ...blankManifest(), releaseEnabled: true })).toThrow()
    expect(() => parseManifest({ ...blankManifest(), sections: [] })).toThrow()
  })
  it('rejects schema smuggling, duplicates and unreviewed approval', () => {
    const m = blankManifest(); m.sections[0].records = [record()]
    expect(() => parseManifest({ ...m, publicExport: true })).toThrow()
    m.sections[1].records = [record()]; expect(() => parseManifest(m)).toThrow()
    m.sections[1].records = []; m.sections[0].records[0].provenance.reviewedBy = null
    expect(() => parseManifest(m)).toThrow()
  })
  it('preserves disputed narratives but rejects disputed actual income', () => {
    const m = blankManifest(); const r = record(); m.sections[0].records = [r]
    r.verification = 'disputed'; expect(() => parseManifest(m)).toThrow()
    r.provenance.conflictNote = 'Two synthetic records disagree; unresolved'
    expect(parseManifest(m).sections[0].records[0].verification).toBe('disputed')
    r.kind = 'financial'; r.payload = { label: 'Synthetic', kind: 'actual-income', basis: 'actual', amountMinor: 0, currency: 'ZAR', periodStart: '2026-10-01', periodEnd: '2026-10-14', reconciliationNote: 'Test' }
    expect(() => parseManifest(m)).toThrow(/actuals/)
  })
  it('stages approved content externally; draft records never reach the batch', async () => {
    const dir = await root(); const m = blankManifest(); m.sections[0].records = [record(), { ...record(), id: '22222222-2222-4222-8222-222222222222', approval: 'draft' }]
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(m))
    const result = await stageLocal(dir, 'manifest.json')
    expect(result).toMatchObject({ approvedCount: 1, withheldCount: 1 })
    const batch = JSON.parse(await readFile(path.join(dir, 'batches', result.batchId, 'batch.json'), 'utf8'))
    expect(batch.releaseEnabled).toBe(false); expect(batch.rows).toHaveLength(1)
    await expect(privateRoot(process.cwd())).rejects.toThrow(/outside/)
    await expect(validateLocal(dir, path.join(process.cwd(), 'package.json'))).rejects.toThrow(/escapes/)
  })
  it('checks bytes, hash, MIME and symlink output escapes', async () => {
    const dir = await root(); await mkdir(path.join(dir, 'sources'))
    const bytes = Buffer.from('%PDF-1.7\nSynthetic test only')
    const r = record(); r.kind = 'pdf'; r.payload = { title: 'Synthetic PDF' }
    r.file = { relativePath: 'sources/test.pdf', sha256: createHash('sha256').update(bytes).digest('hex'), mimeType: 'application/pdf' }
    const m = blankManifest(); m.sections[0].records = [r]
    await writeFile(path.join(dir, 'sources/test.pdf'), bytes)
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(m))
    expect((await validateLocal(dir, 'manifest.json')).files.size).toBe(1)
    await writeFile(path.join(dir, 'sources/test.pdf'), 'changed')
    await expect(validateLocal(dir, 'manifest.json')).rejects.toThrow(/checksum/)
    await writeFile(path.join(dir, 'sources/test.pdf'), bytes)
    const external = await root()
    await symlink(external, path.join(dir, 'batches'), 'junction')
    await expect(stageLocal(dir, 'manifest.json')).rejects.toThrow(/escapes/)
  })
  it('blocks private manifests and documents from the public build boundary', async () => {
    const dir = await root(); await mkdir(path.join(dir, 'public'))
    await writeFile(path.join(dir, 'public', 'legal.pdf'), 'synthetic')
    expect(() => assertPublicAssets(dir)).toThrow(/blocked/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('content-migration/local-importer.ts'))).toThrow(/frontend/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('src/App.tsx'), 'JB3_PRIVATE_CONTENT_V1')).toThrow(/Private manifest/)
  })
})
