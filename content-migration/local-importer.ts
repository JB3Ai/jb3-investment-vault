import { realpath, readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { blankManifest, parseManifest, type ContentManifest } from './ingestion-schema.ts'
import { parseMaster, parseMasterIntake, canonicalPresentation, masterPrintHtml } from './master-content.ts'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inside = (parent: string, candidate: string) => { const rel = path.relative(parent, candidate); return rel === '' || !rel.startsWith('..') && !path.isAbsolute(rel) }
export async function privateRoot(root: string) {
  const real = await realpath(root), repo = await realpath(repository)
  if (inside(repo, real) || inside(real, repo)) throw new Error('Private root must be outside and separate from the repository')
  return real
}
export async function privateFile(root: string, filename: string) {
  const resolved = await realpath(path.resolve(root, filename))
  if (!inside(root, resolved) || inside(await realpath(repository), resolved)) throw new Error('Private file escapes its external custody root')
  if (!(await stat(resolved)).isFile()) throw new Error('Source must be a regular file')
  return resolved
}
function signature(bytes: Buffer, mime: string) {
  if (mime === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-'
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
}
/** Review catalogues cannot be staged. Actual export batches retain the original limits. */
export function assertPrivateFileLimits(size:number,total:number,reviewCatalogue=false) {
  if(size<1||size>25*1024*1024||total>(reviewCatalogue?256:100)*1024*1024)throw new Error('Private file/catalogue or export batch size limit exceeded')
}
export async function validateLocal(rootInput: string, manifestName: string) {
  const root = await privateRoot(rootInput)
  const filename = await privateFile(root, manifestName)
  if ((await stat(filename)).size > 10 * 1024 * 1024) throw new Error('Manifest exceeds 10 MiB')
  const source = await readFile(filename)
  const parsed = JSON.parse(source.toString('utf8').replace(/^\uFEFF/, ''))
  const master = parsed?.format === 'JB3_APPROVED_MASTER_V1' ? parseMaster(parsed) : null
  const intake = parsed?.format === 'JB3_MASTER_INTAKE_V1' ? parseMasterIntake(parsed) : null
  const manifest = master?.content ?? intake?.content ?? parseManifest(parsed)
  const files = new Map<string, Buffer>()
  let total = 0
  for (const section of manifest.sections) for (const record of section.records) {
    if (!record.file) continue
    const input = await privateFile(root, record.file.relativePath)
    const size = (await stat(input)).size
    total += size
    assertPrivateFileLimits(size,total,intake!==null)
    const bytes = await readFile(input)
    if (createHash('sha256').update(bytes).digest('hex') !== record.file.sha256.toLowerCase()) throw new Error('Source checksum mismatch; review the changed source')
    if (!signature(bytes, record.file.mimeType)) throw new Error('Source signature does not match declared media type')
    files.set(record.id.toLowerCase(), bytes)
  }
  return { root, manifest, files, master, intake, sourceSha256: createHash('sha256').update(source).digest('hex') }
}
export function stageRows(manifest: ContentManifest) {
  parseManifest(manifest)
  return manifest.sections.flatMap(section => section.records.filter(r => r.approval === 'approved').map(record => ({
    id: record.id.toLowerCase(), section_id: section.id, kind: record.kind, classification: record.classification,
    verification: record.verification, approval: record.approval, provenance: record.provenance,
    payload: record.payload, storage_path: record.file ? `${record.classification}/${record.id.toLowerCase()}/${record.file.sha256.toLowerCase()}` : null,
    sha256: record.file?.sha256.toLowerCase() ?? null, mime_type: record.file?.mimeType ?? null,
  })))
}
export async function stageLocal(rootInput: string, manifestName: string) {
  const { root, manifest, files, master, intake, sourceSha256 } = await validateLocal(rootInput, manifestName)
  if (intake) throw new Error('Review-only master intake cannot be staged or exported; final owner approval required')
  // Fixed output location; no --output escape hatch or public export mode.
  await mkdir(path.join(root, 'batches'), { recursive: true })
  const batches = await realpath(path.join(root, 'batches'))
  if (!inside(root, batches) || inside(await realpath(repository), batches)) throw new Error('Batch output escapes private custody')
  const output = path.join(batches, randomUUID())
  await mkdir(output)
  const rows = stageRows(manifest)
  for (const row of rows) if (row.storage_path) {
    const target = path.join(output, 'objects', row.storage_path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, files.get(row.id)!, { flag: 'wx', mode: 0o600 })
  }
  if (master) {
    // These derivatives stay in private custody. No renderer rewrites narrative strings.
    await writeFile(path.join(output, 'approved-master.json'), JSON.stringify(master, null, 2), { flag: 'wx', mode: 0o600 })
    await writeFile(path.join(output, 'presentation.json'), JSON.stringify(canonicalPresentation(master), null, 2), { flag: 'wx', mode: 0o600 })
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ javaScriptEnabled: false })
      await page.route('**/*', route => route.abort())
      await page.setContent(masterPrintHtml(master))
      await page.pdf({ path: path.join(output, 'investor-presentation.pdf'), format: 'A4', printBackground: true })
    } finally { await browser.close() }
  }
  // Write metadata last. Failed batches have no completion manifest and must not be loaded.
  await writeFile(path.join(output, 'batch.json'), JSON.stringify({ format: 'JB3_PRIVATE_CONTENT_V1', releaseEnabled: false, sourceSha256, hasMasterPresentation: master !== null, table: 'vault_content_records', bucket: 'vault-evidence', rows }, null, 2), { flag: 'wx', mode: 0o600 })
  return { batchId: path.basename(output), approvedCount: rows.length, withheldCount: manifest.sections.reduce((n, s) => n + s.records.length, 0) - rows.length }
}
async function cli() {
  const [command, root, manifestName = 'manifest.json', ...extra] = process.argv.slice(2)
  if (!root || extra.length || !['init', 'validate', 'stage'].includes(command)) throw new Error('Usage: npm run content:import -- init|validate|stage PRIVATE_ROOT [manifest.json]')
  if (command === 'init') {
    const safeRoot = await privateRoot(root)
    await mkdir(path.join(safeRoot, 'sources'), { recursive: true })
    for (const section of blankManifest().sections) await mkdir(path.join(safeRoot, 'sources', section.id), { recursive: true })
    await writeFile(path.join(safeRoot, 'manifest.json'), JSON.stringify(blankManifest(), null, 2), { flag: 'wx', mode: 0o600 })
    console.log('Created empty eleven-section manifest. No source facts inserted.')
  } else if (command === 'validate') {
    const result = await validateLocal(root, manifestName)
    console.log(JSON.stringify({ sections: result.manifest.sections.length, records: result.manifest.sections.reduce((n,s) => n + s.records.length, 0), releaseEnabled: false }))
  } else console.log(JSON.stringify(await stageLocal(root, manifestName)))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => { console.error(error instanceof SyntaxError ? 'Invalid JSON manifest' : error instanceof Error && !('code' in error) ? error.message : 'Private filesystem operation failed; check paths and permissions'); process.exitCode = 1 })
}
