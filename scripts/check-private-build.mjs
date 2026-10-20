// Compare outputs in memory; never print private tokens, records or credentials.
import { readdir, readFile } from 'node:fs/promises'
import { loadEnvFile } from 'node:process'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

loadEnvFile('.env.local')
const response = await fetch('http://127.0.0.1:5174/api/vault/local-review/content', { headers: { 'X-Vault-Local-Review': '1' } })
assert.equal(response.status, 200)
const review = await response.json()
const records = [...review.sections.map(section => section.narrative), ...review.laboratory.records, ...review.laboratory.photographs, ...review.documents, ...review.finances.personal, ...review.finances.business]
const tokens = [...new Set([...records.flatMap(record => [record.id, record.provenance.originalFilename, record.kind === 'narrative' ? String(record.payload.body).slice(0, 180) : '']), ...(review.laboratory.review?.videos ?? []).flatMap(video => [video.id, video.url, new URL(video.url).searchParams.get('v') ?? new URL(video.url).pathname.slice(1)])].filter(token => token && token.length > 8))]
tokens.push(...(review.thumbnailPreviews??[]).flatMap(item=>[item.recordId,item.originalFilename,item.sha256]),...(review.evidenceReviews??[]).flatMap(item=>[item.summary,...item.assertions,...item.verificationHolds]))
tokens.push(...(review.assets?.entries??[]).flatMap(entry=>[entry.id,...entry.verificationNotes]),...(review.finances.funding?[review.finances.funding.source.sha256]:[]))
tokens.push(...(review.commercial?[review.commercial.source.originalFilename,review.commercial.source.sha256,...review.commercial.entries.flatMap(entry=>[entry.recordId,entry.title,entry.positioning,...entry.limitations,...entry.missingEvidence,...(entry.ownershipNote?[entry.ownershipNote]:[])])]:[]))
tokens.push(...(review.evidenceReviews??[]).flatMap(item=>Object.entries(item.metadata).filter(([key,value])=>/^portfolio\.(title|association|description|ownershipNote|ownerSource)$/.test(key)&&value&&value.length>8).map(([,value])=>value)))
const thumbnailHashes=new Set((review.thumbnailPreviews??[]).map(item=>item.sha256))
const secrets = Object.entries(process.env).filter(([name, value]) => /SUPABASE_(SECRET_KEY|SERVICE_ROLE_KEY)$/.test(name) && value).map(([,value]) => value)
let files = 0, leaks = 0
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Unexpected output symlink')
    if (entry.isDirectory()) { await scan(file); continue }
    const bytes = await readFile(file); files++
    if(thumbnailHashes.has(createHash('sha256').update(bytes).digest('hex')))leaks++
    if (/\.(xlsx?|pdf|jpe?g|zip|docx?)$/i.test(entry.name)) leaks++
    if ([...tokens, ...secrets].some(token => bytes.includes(Buffer.from(token)) || bytes.includes(Buffer.from(JSON.stringify(token).slice(1, -1))))) leaks++
    if (/JB3_(PRIVATE_CONTENT|APPROVED_MASTER|MASTER_INTAKE|SUPPORTING_EVIDENCE_REVIEW|FUNDING_PROPOSAL|ASSET_REVIEW|COMMERCIAL_REVIEW)_V1|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|JB3_LOCAL_PRESENTATION_PIN|presentation-pin|local-review\/financial-export|artifact-tool/.test(bytes.toString('utf8'))) leaks++
  }
}
await scan('dist'); await scan('public')
const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean)
assert.equal(names.some(name => /\.(xlsx?|pdf|jpe?g)$/i.test(name)), false, 'No private source binaries tracked')
assert.equal(leaks, 0, 'Private build boundary failed; private values omitted')
console.log(`Private-asset scan PASS: ${files} output files, ${records.length} content records and ${review.thumbnailPreviews?.length??0} protected thumbnails and ${review.assets?.entries.length??0} asset annotations checked, no source documents, private records, export runtime or server credentials found.`)
