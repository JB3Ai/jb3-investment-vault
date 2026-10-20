import {PresentationPin,readPresentationPin} from './presentationPin.ts'
import { loadFundingProposal } from './fundingProposal.ts'
import { loadCommercialReview } from './commercialReview.ts'
import { loadAssetReview } from './assetReview.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { privateFile, validateLocal } from '../content-migration/local-importer.ts'
import type { ContentRecord } from '../content-migration/ingestion-schema.ts'
import type { LocalReview } from '../src/lib/localReview.ts'
import { createFinancialWorkbook, readExportRequest } from './financialExport.ts'
import { parseLaboratoryReview } from './laboratoryReview.ts'
import { revisedFinances } from './financialRevision.ts'
import { generateMasterPdf } from './masterPdf.ts'
import { loadSupportingEvidence, localAssetAllowed } from './supportingEvidence.ts'
import { thumbnailReference } from '../src/lib/thumbnailReference.ts'

const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
const plain = (bytes: Buffer) => bytes.toString('utf8').replace(/^\uFEFF/, '')

/** Uses the existing importer and private review envelope, never stages drafts. */
export async function loadLocalReview(root: string) {
  const validated = await validateLocal(root, 'master-intake.json')
  const { intake, manifest } = validated
  if (!intake || manifest.releaseEnabled !== false) throw new Error('Private review intake required')
  const master = plain(await readFile(await privateFile(validated.root, 'sources/master/JB3_Bruce_Vault_Master_Content_v2.md'))).replace(/\r\n/g, '\n')
  const sections: LocalReview['sections'] = manifest.sections.map(section => {
    const approved = section.records.filter(record => record.kind === 'narrative' && record.approval === 'approved')
    if (approved.length !== 1) throw new Error('Exactly one approved main narrative required per section')
    const record = approved[0]
    const start = master.indexOf(`# ${record.payload.heading}\n`)
    const end = master.indexOf('\n# ', start + 1)
    // Intake preserves the final newline before the following top-level heading.
    const original = master.slice(start, end === -1 ? undefined : end + 1)
    if (record.classification !== 'BRUCE_PRIVATE' || record.provenance.conflictNote || !['reported', 'documented'].includes(record.verification) || !record.provenance.reviewedBy || !record.provenance.reviewedOn || start < 0 || !original.includes(String(record.payload.body))) throw new Error('Approved narrative does not match the private canonical master')
    return { id: section.id, narrative: { ...record, kind: 'narrative' as const, approval: 'approved' as const, classification: 'BRUCE_PRIVATE' as const, verification: record.verification as 'reported' | 'documented', payload: { heading: String(record.payload.heading), body: String(record.payload.body) }, section_id: section.id, storage_path: null, sha256: null, mime_type: null } }
  })
  const all = manifest.sections.flatMap(section => section.records)
  const evidence = await loadSupportingEvidence(validated.root, manifest)
  const select = (ids: string[]) => ids.map(id => {
    const record = all.find(record => record.id === id)
    if (!record) throw new Error('Missing referenced intake record')
    return record
  })
  // Verify the retained financial extraction is still tied to the actual workbook.
  const extraction = JSON.parse(plain(await readFile(await privateFile(validated.root, 'workbook-extract.json'))))
  const workbook = await readFile(await privateFile(validated.root, `sources/${extraction.originalFilename}`))
  if (hash(workbook) !== extraction.sha256) throw new Error('Workbook changed since intake; financial reconciliation required')
  for (const schedule of ['personal', 'business'] as const) {
    const rows = select(intake.financialSchedules[schedule])
    const sheet = extraction.sheets.find((sheet: { name: string }) => sheet.name.toLowerCase() === schedule)
    if (!sheet || rows.length !== sheet.rows.length) throw new Error('Financial schedule mapping mismatch')
    for (const record of rows) {
      const rowNumber = Number(record.provenance.citation.match(/!A(\d+):/)?.[1])
      const row = sheet.rows.find((row: { row: number }) => row.row === rowNumber)
      const note = JSON.parse(String(record.payload.reconciliationNote))
      if (!row || row.amountMinor !== record.payload.amountMinor || row.label !== record.payload.label || row.formula !== note.formula || record.provenance.sourceReference !== `sha256:${extraction.sha256}`) throw new Error('Financial source/extraction discrepancy')
    }
  }
  const financeReview = JSON.parse(plain(await readFile(await privateFile(validated.root, 'intake-batch-01/review/financial-review.json'))))
  const photographs = manifest.sections[2].records.filter(record => record.kind === 'photograph' && !thumbnailReference(record.provenance.sourceReference)).sort((a, b) => a.file!.relativePath.localeCompare(b.file!.relativePath))
  let laboratoryReview: LocalReview['laboratory']['review'] = null
  try {
    laboratoryReview = parseLaboratoryReview(JSON.parse(plain(await readFile(await privateFile(validated.root, 'intake-batch-01/review/laboratory-display-review.json')))), photographs)
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const data: LocalReview = {
    sections,
    laboratory: {
      title: intake.laboratoryShowcase?.title ?? '23-Day Laboratory Showcase',
      records: select(intake.laboratoryShowcase?.recordIds ?? []),
      // Established numbered mapping is a review sequence, never a claimed chronology.
      photographs,
      review: laboratoryReview,
    },
    documents: all.filter(record => record.kind === 'pdf'),
    evidenceReviews: evidence.reviews,
    localDocumentPreviewIds: evidence.allowed,
    thumbnailPreviews: all.flatMap(record=>{const link=thumbnailReference(record.provenance.sourceReference);return link?[{recordId:record.id,parentId:link.parentId,sha256:record.file!.sha256,originalFilename:record.provenance.originalFilename,classification:record.classification,approval:record.approval,available:evidence.allowed.includes(link.parentId)}]:[]}),
    commercial: await loadCommercialReview(validated.root, manifest),
    assets: await loadAssetReview(validated.root, manifest),
    finances: await loadFundingProposal(validated.root, await revisedFinances(validated.root, { personal: select(intake.financialSchedules.personal), business: select(intake.financialSchedules.business), exchangeRate: intake.exchangeRate, findings: financeReview.findings })),
  }
  return { data, root: validated.root, records: new Map(all.map(record => [record.id, record])) }
}

export function localReviewAllowed(request: { headers: IncomingMessage['headers']; socket: { remoteAddress?: string } }) {
  const host = request.headers.host
  const address = request.socket.remoteAddress
  if (!host || !/^127\.0\.0\.1:\d+$/.test(host) || !['127.0.0.1', '::ffff:127.0.0.1'].includes(address ?? '')) return false
  if (request.headers.origin && request.headers.origin !== `http://${host}`) return false
  if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers['x-vault-local-review'] !== '1') return false
  return true
}

export function privateLocalReview(root: string): Plugin {
  let loaded: Awaited<ReturnType<typeof loadLocalReview>> | null = null
  let exporting = false
  const presentationPin=new PresentationPin()
  return {
    name: 'vault-private-owner-review', apply: 'serve',
    async configureServer(server) {
      if (server.config.mode !== 'private-local' || server.config.server.host !== '127.0.0.1') throw new Error('Private preview requires explicit loopback-only mode')
      loaded = await loadLocalReview(root)
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/vault/')) return next()
        response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
        response.setHeader('CDN-Cache-Control', 'no-store')
        response.setHeader('Cloudflare-CDN-Cache-Control', 'no-store')
        response.setHeader('Pragma', 'no-cache')
        response.setHeader('Expires', '0')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
        const deny = (status: number) => { response.statusCode = status; response.end() }
        if (!localReviewAllowed(request)) return deny(403)
        if (!loaded) return deny(503)
        if(request.url==='/api/vault/local-review/presentation-pin'){
          if(request.method!=='POST')return deny(405)
          let value:unknown;try{value=await readPresentationPin(request)}catch{return deny(400)}
          const result=presentationPin.check(value);response.statusCode=result.status
          if(result.retryAfter)response.setHeader('Retry-After',String(result.retryAfter))
          response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ok:result.status===200}));return
        }
        if (['/api/vault/local-review/financial-export','/api/vault/local-review/master-pdf'].includes(request.url??'')) {
          if (request.method !== 'POST') return deny(405)
          if (exporting) return deny(429)
          let options: Awaited<ReturnType<typeof readExportRequest>>
          try { options = await readExportRequest(request) } catch { return deny(400) }
          if (exporting) return deny(429)
          exporting = true
          try {
            // Revalidate the existing private intake, canonical master and source hashes.
            const current = await loadLocalReview(root)
            if (JSON.stringify(current.data.finances) !== JSON.stringify(loaded.data.finances) || JSON.stringify(current.data.assets) !== JSON.stringify(loaded.data.assets) || request.url === '/api/vault/local-review/master-pdf' && (JSON.stringify(current.data.commercial) !== JSON.stringify(loaded.data.commercial) || JSON.stringify(current.data.evidenceReviews) !== JSON.stringify(loaded.data.evidenceReviews))) return deny(409)
            if(request.url==='/api/vault/local-review/master-pdf'){
              if(options.scope!=='combined')return deny(400)
              const bytes=await generateMasterPdf(current.root,current.data,options.zarPerGbp,options.scenario)
              response.setHeader('Content-Type','application/pdf');response.setHeader('Content-Disposition','attachment; filename="JB3-private-master.pdf"');response.setHeader('Content-Length',bytes.length);response.end(bytes);return
            }
            const bytes = await createFinancialWorkbook(current.data.finances, options.scope, options.zarPerGbp, options.scenario)
            response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            response.setHeader('Content-Disposition', `attachment; filename="JB3-${options.scope}-draft.xlsx"`)
            response.setHeader('Content-Length', bytes.length)
            response.end(bytes)
          } catch { deny(503) }
          finally { exporting = false }
          return
        }
        if (!['GET', 'HEAD'].includes(request.method ?? '')) return deny(405)
        if (request.url === '/api/vault/local-review/content') {
          try { loaded=await loadLocalReview(root) } catch { return deny(503) }
          response.setHeader('Content-Type', 'application/json')
          return response.end(request.method === 'HEAD' ? undefined : JSON.stringify(loaded.data))
        }
        const match = request.url.match(/^\/api\/vault\/local-review\/assets\/([0-9a-f-]{36})$/)
        let record: ContentRecord | undefined = match && loaded.records.get(match[1]) || undefined
        if(record&&(record.kind==='pdf'||thumbnailReference(record.provenance.sourceReference))){
          try{loaded=await loadLocalReview(root);record=loaded.records.get(record.id)}catch{return deny(503)}
        }
        if (!record?.file || !['pdf', 'photograph'].includes(record.kind)) return deny(404)
        // Registration alone never grants binary access, including HEAD/ranges.
        if (!localAssetAllowed(record.id,record.kind,loaded.data.localDocumentPreviewIds??[],loaded.data.thumbnailPreviews??[])) return deny(403)
        try {
          // UUID resolves only verified manifest metadata; never accept a caller path or bucket.
          const bytes = await readFile(await privateFile(loaded.root, record.file.relativePath))
          if (hash(bytes) !== record.file.sha256.toLowerCase()) return deny(409)
          response.setHeader('Content-Type', record.file.mimeType)
          response.setHeader('Content-Disposition', 'inline')
          response.setHeader('Accept-Ranges', 'bytes')
          let start = 0, end = bytes.length - 1
          if (request.headers.range) {
            const range = request.headers.range.match(/^bytes=(\d+)-(\d*)$/)
            if (!range) return deny(416)
            start = Number(range[1]); end = range[2] ? Number(range[2]) : end
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length || end >= bytes.length) return deny(416)
            response.statusCode = 206
            response.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`)
          }
          response.setHeader('Content-Length', end - start + 1)
          response.end(request.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1))
        } catch { deny(503) }
      })
    },
  }
}
