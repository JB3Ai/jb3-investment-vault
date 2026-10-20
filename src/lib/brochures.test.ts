import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { brochureCategories, brochureDocument, brochureEntries, brochureAssociation, type BrochureDocument } from './brochures'
import { loadApprovedBrochures } from './privateContent'
const base: BrochureDocument = { id: 'sample', title: 'Synthetic proposal', originalFilename: 'Example_Proposal_v1.pdf', classification: 'BRUCE_PRIVATE', approval: 'draft', verification: 'reported', sourceDate: null, citation: 'Synthetic fixture p1', sourceReference: 'Synthetic fixture only', sha256: null }
function fixture(options: { released?: boolean; anonymous?: boolean; rows?: object[]; images?: object[] } = {}) {
  const calls: { table: string; filters: unknown[][] }[] = []
  const client = { auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: 'synthetic-user' } }, error: null }) }, from(table: string) {
    const call = { table, filters: [] as unknown[][] }; calls.push(call)
    const result = () => ({ error: null, data: table.includes('settings') ? { access_enabled: options.released !== false } : call.filters.some(args => args[1] === 'photograph') ? options.images ?? [] : options.rows ?? [] })
    const chain = { select() { return chain }, eq(...args: unknown[]) { call.filters.push(args); return chain }, in(...args: unknown[]) { call.filters.push(args); return chain }, order() { return Promise.resolve(result()) }, single() { return Promise.resolve(result()) } }
    return chain
  } } as unknown as SupabaseClient
  return { client, calls }
}
const pdf = { id: '11111111-1111-4111-8111-111111111111', kind: 'pdf', approval: 'approved', classification: 'BRUCE_PRIVATE', verification: 'documented', payload: { title: 'Synthetic brief' }, provenance: { sourceReference: 'synthetic only' }, storage_path: 'private/fixture.pdf', mime_type: 'application/pdf', sha256: 'a'.repeat(64) }
describe('private brochure projection', () => {
  it('excludes legal and rejected records before grouping, including their metadata', () => {
    const entries = brochureEntries([base, { ...base, id: 'legal', classification: 'LEGAL_RESTRICTED', title: 'Excluded private claim' }, { ...base, id: 'rejected', approval: 'rejected' }])
    expect(entries).toHaveLength(1); expect(entries[0].versions).toHaveLength(1)
    expect(JSON.stringify(entries)).not.toContain('Excluded private claim')
  })
  it('consolidates compressed copies and superseded numbered editions while preserving history and draft status', () => {
    const entries = brochureEntries([base, { ...base, id: 'compressed', originalFilename: 'Example_Proposal_v1_compressed.pdf' }, { ...base, id: 'old', originalFilename: 'Example_Proposal_v0_superseded.pdf', approval: 'approved' }, { ...base, id: 'current', originalFilename: 'Example_Proposal_v2.pdf' }])
    expect(entries).toHaveLength(1); expect(entries[0].versions).toHaveLength(4)
    expect(entries[0].document.id).toBe('current'); expect(entries[0].document.approval).toBe('draft')
    expect(base.approval).toBe('draft')
  })
  it('deduplicates byte-identical copies without merging classifications', () => {
    const a = { ...base, sha256: 'a'.repeat(64) }
    expect(brochureEntries([a, { ...a, id: 'copy', originalFilename: 'Different copy.pdf' }])).toHaveLength(1)
    expect(brochureEntries([a, { ...a, id: 'commercial', classification: 'COMMERCIAL' }])).toHaveLength(2)
  })
  it('organises categories without inventing dates, associations or signed relationships', () => {
    const entries = brochureEntries([base, { ...base, id: 'technical', title: 'Synthetic technical brief', originalFilename: 'technical.pdf' }, { ...base, id: 'education', title: 'Education overview', originalFilename: 'education.pdf' }, { ...base, id: 'investment', title: 'Investment presentation', originalFilename: 'investment.pdf' }])
    expect(new Set(entries.map(row => row.category)).size).toBe(4)
    expect(entries[0].document.sourceDate).toBeNull()
    expect(brochureAssociation(base)).toContain('Not separately recorded')
    expect(brochureCategories).toHaveLength(4)
  })
})
describe('authenticated brochure adapter', () => {
  it('denies anonymous users before any database requests', async () => {
    const { client, calls } = fixture({ anonymous: true })
    await expect(loadApprovedBrochures(client)).rejects.toThrow('Authenticated access required'); expect(calls).toHaveLength(0)
  })
  it('fails closed on release gates before requesting records', async () => {
    const { client, calls } = fixture({ released: false })
    await expect(loadApprovedBrochures(client)).rejects.toThrow('Confidential release remains disabled'); expect(calls.some(call => call.table === 'vault_content_records')).toBe(false)
  })
  it('requests only approved nonlegal PDFs and checks classification defensively', async () => {
    const { client, calls } = fixture({ rows: [pdf] })
    const result = await loadApprovedBrochures(client); expect(result.documents).toHaveLength(1)
    expect(calls.find(call => call.table === 'vault_content_records')?.filters).toEqual([['kind', 'pdf'], ['approval', 'approved'], ['classification', ['BRUCE_PRIVATE', 'COMMERCIAL']]])
    await expect(loadApprovedBrochures(fixture({ rows: [{ ...pdf, classification: 'LEGAL_RESTRICTED' }] }).client)).rejects.toThrow()
    await expect(loadApprovedBrochures(fixture({ rows: [{ ...pdf, approval: 'draft' }] }).client)).rejects.toThrow()
  })
  it('accepts covers only when parent classification and both checksums match', async () => {
    const cover = { ...pdf, id: '22222222-2222-4222-8222-222222222222', kind: 'photograph', mime_type: 'image/png', sha256: 'b'.repeat(64), provenance: { sourceReference: 'thumbnail-of:' + pdf.id + ';parent-sha256:' + 'a'.repeat(64) + ';sha256:' + 'b'.repeat(64) } }
    expect((await loadApprovedBrochures(fixture({ rows: [pdf], images: [cover] }).client)).thumbnails).toHaveLength(1)
    for (const change of [{ classification: 'LEGAL_RESTRICTED' }, { sha256: 'c'.repeat(64) }, { approval: 'draft' }]) expect((await loadApprovedBrochures(fixture({ rows: [pdf], images: [{ ...cover, ...change }] }).client)).thumbnails).toHaveLength(0)
  })
})

it('uses existing review metadata and keeps a cover companion behind the full document card',()=>{
 const full={...base,id:'full',originalFilename:'Synthetic magazine-combined.pdf',versionGroup:'synthetic-magazine',editionRole:'full-document'}
 const cover={...full,id:'cover',originalFilename:'Synthetic magazine cover.pdf',editionRole:'cover-only'}
 const entries=brochureEntries([cover,full]);expect(entries).toHaveLength(1);expect(entries[0].document.id).toBe('full');expect(entries[0].versions).toHaveLength(2)
})

it('uses owner-supplied supersession metadata without renaming originals or losing history',()=>{
 const old={...base,id:'a-old',originalFilename:'Original executive deck.pdf',versionGroup:'synthetic-deck',editionRole:'superseded',approval:'approved' as const}
 const current={...base,id:'z-new',originalFilename:'Replacement presentation.pdf',versionGroup:'synthetic-deck',editionRole:'full-document'}
 const entry=brochureEntries([old,current])[0]
 expect(entry.document.id).toBe('z-new');expect(entry.document.approval).toBe('draft')
 expect(entry.versions.map(record=>record.id)).toEqual(['z-new','a-old'])
 expect(old.originalFilename).toBe('Original executive deck.pdf')
 expect(brochureEntries([{...old,editionRole:undefined,originalFilename:'Executive deck v9 superseded.pdf'},current])[0].document.id).toBe('z-new')
})

it('cleans filename-style display titles without mutating source provenance or approval',()=>{
 const record: Parameters<typeof brochureDocument>[0]={...pdf,kind:'pdf',approval:'approved',classification:'BRUCE_PRIVATE',verification:'documented',section_id:'assets-claims',provenance:{originalFilename:'02_v6_Synthetic_Brief.pdf',sourceDate:null,citation:'Synthetic p1',sourceReference:'sha256:'+'a'.repeat(64),reviewedBy:'Synthetic owner',reviewedOn:'2026-10-19',conflictNote:null},payload:{title:'02_v6_Synthetic_Brief.pdf'}}
 const before=JSON.stringify(record),view=brochureDocument(record,{'brochure.category':'Client Proposals','brochure.association':'Synthetic subject / unverified'})
 expect(view.title).toBe('Synthetic Brief');expect(view.originalFilename).toBe('02_v6_Synthetic_Brief.pdf');expect(view.category).toBe('Client Proposals');expect(JSON.stringify(record)).toBe(before)
})

it('excludes a Sunday World document from the authenticated brochure adapter before loading covers',async()=>{
 const {client,calls}=fixture({rows:[{...pdf,payload:{title:'Sunday World proposal'}}]})
 const result=await loadApprovedBrochures(client);expect(result.documents).toEqual([]);expect(result.thumbnails).toEqual([]);expect(calls.filter(call=>call.table==='vault_content_records')).toHaveLength(1)
})
