import {presentationView} from '../src/lib/presentationCopy.ts'
import { parseManifest, type ContentManifest, type ContentRecord } from './ingestion-schema.ts'

/** Private data contract only. Never import a populated document into frontend code. */
export interface ApprovedMaster {
  format: 'JB3_APPROVED_MASTER_V1'
  content: ContentManifest
  laboratoryShowcase: { title: string; recordIds: string[] } | null
  financialSchedules: { personal: string[]; business: string[] }
  exchangeRate: { zarPerGbp: number; asOf: string; source: string; approvedBy: string; approvedOn: string } | null
}
/** Review-only envelope. Never render/stage it as an approved presentation. */
export interface MasterIntake extends Omit<ApprovedMaster, 'format' | 'exchangeRate'> {
  format: 'JB3_MASTER_INTAKE_V1'
  exchangeRate: { zarPerGbp: number; asOf: string | null; source: string; approvedBy: string | null; approvedOn: string | null } | null
}
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message) }
function fields(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'Master: exact schema fields required')
}
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function date(value: unknown) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
function parseDocument(input: unknown, approved: boolean): unknown {
  fields(input, ['format', 'content', 'laboratoryShowcase', 'financialSchedules', 'exchangeRate'])
  requireValue(input.format === (approved ? 'JB3_APPROVED_MASTER_V1' : 'JB3_MASTER_INTAKE_V1'), 'Master: unsupported format')
  const content = parseManifest(input.content)
  const all = content.sections.flatMap(s => s.records)
  requireValue(!approved || all.every(r => r.approval === 'approved'), 'Master: every included record must be approved; hold drafts separately')
  const used = new Set<string>()
  const lookup = new Map(all.map(r => [r.id.toLowerCase(), r]))
  function references(value: unknown, kind?: string): string[] {
    requireValue(Array.isArray(value), 'Master: record ID array required')
    for (const id of value) {
      requireValue(typeof id === 'string', 'Master: invalid reference')
      const r = lookup.get(id.toLowerCase())
      requireValue(r && !used.has(id.toLowerCase()) && (!kind || r.kind === kind), 'Master: missing, duplicate or wrong-kind reference')
      used.add(id.toLowerCase())
    }
    return value as string[]
  }
  if (input.laboratoryShowcase !== null) {
    fields(input.laboratoryShowcase, ['title', 'recordIds'])
    requireValue(nonempty(input.laboratoryShowcase.title), 'Master: showcase title required')
    const ids = references(input.laboratoryShowcase.recordIds)
    requireValue(ids.length > 0 && ids.every(id => content.sections[2].records.some(r => r.id.toLowerCase() === id.toLowerCase() && ['narrative', 'photograph', 'pdf'].includes(r.kind))), 'Master: showcase must reference Section 03 narrative/photo/PDF records')
  }
  requireValue(content.sections.every(s => s.records.some(r => r.kind === 'narrative' && !used.has(r.id.toLowerCase()))), 'Master: approved narrative required for each of eleven sections')
  fields(input.financialSchedules, ['personal', 'business'])
  references(input.financialSchedules.personal, 'financial')
  references(input.financialSchedules.business, 'financial')
  const finances = all.filter(r => r.kind === 'financial')
  requireValue(finances.every(r => used.has(r.id.toLowerCase()) && ['ZAR', 'GBP'].includes(String(r.payload.currency))), 'Master: every financial record needs exactly one schedule and ZAR/GBP currency')
  requireValue(!finances.length || input.exchangeRate !== null, 'Master: explicit exchange-rate assumption required')
  if (input.exchangeRate !== null) {
    fields(input.exchangeRate, ['zarPerGbp', 'asOf', 'source', 'approvedBy', 'approvedOn'])
    const fx = input.exchangeRate
    requireValue(typeof fx.zarPerGbp === 'number' && Number.isFinite(fx.zarPerGbp) && fx.zarPerGbp > 0 && (date(fx.asOf) || !approved && fx.asOf === null) && (date(fx.approvedOn) || !approved && fx.approvedOn === null) && nonempty(fx.source) && (nonempty(fx.approvedBy) || !approved && fx.approvedBy === null), 'Master: invalid exchange-rate assumption/review')
  }
  return input
}
export function parseMaster(input: unknown): ApprovedMaster { return parseDocument(input, true) as ApprovedMaster }
export function parseMasterIntake(input: unknown): MasterIntake { return parseDocument(input, false) as MasterIntake }
export function dualCurrency(record: ContentRecord, zarPerGbp: number) {
  const amount = record.payload.amountMinor
  requireValue(record.kind === 'financial' && typeof amount === 'number' && Number.isSafeInteger(amount) && ['ZAR', 'GBP'].includes(String(record.payload.currency)) && Number.isFinite(zarPerGbp) && zarPerGbp > 0, 'Invalid dual-currency input')
  const zar = record.payload.currency === 'ZAR' ? amount : Math.round(amount * zarPerGbp)
  const gbp = record.payload.currency === 'GBP' ? amount : Math.round(amount / zarPerGbp)
  requireValue(Number.isSafeInteger(zar) && Number.isSafeInteger(gbp), 'Converted amount exceeds safe precision')
  const format = (minor: number, currency: string) => `${currency} ${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return { zarMinor: zar, gbpMinor: gbp, display: `${format(zar, 'ZAR')} / ${format(gbp, 'GBP')}` }
}
/** Single view model for future authenticated web rendering and the private PDF.
 * Not an authorization API: callers must authorize every record before rendering. */
export function canonicalPresentation(input: ApprovedMaster) {
  const master = parseMaster(input)
  const records = master.content.sections.flatMap(s => s.records)
  const select = (ids: string[]) => ids.map(id => records.find(r => r.id.toLowerCase() === id.toLowerCase())!)
  const showcaseIds = new Set(master.laboratoryShowcase?.recordIds.map(id => id.toLowerCase()))
  const blocks = master.content.sections.flatMap((section, index) => {
    const block = { id: section.id as string, number: index + 1 as number | null, title: String(section.records.find(r => r.kind === 'narrative' && !showcaseIds.has(r.id.toLowerCase()))!.payload.heading), records: section.records.filter(r => !showcaseIds.has(r.id.toLowerCase()) && r.kind !== 'financial') }
    return index === 2 && master.laboratoryShowcase ? [block, { id: 'laboratory-showcase', number: null, title: master.laboratoryShowcase.title, records: select(master.laboratoryShowcase.recordIds) }] : [block]
  })
  const schedule = (ids: string[]) => select(ids).map(record => ({ record, ...dualCurrency(record, master.exchangeRate!.zarPerGbp) }))
  return { format: 'JB3_APPROVED_MASTER_V1' as const, blocks, financialSchedules: { personal: schedule(master.financialSchedules.personal), business: schedule(master.financialSchedules.business) }, exchangeRate: master.exchangeRate }
}
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
/** Text-only evidence appendix: originals remain separate authenticated downloads. */
export function masterPrintHtml(master: ApprovedMaster) {
  const view = presentationView(canonicalPresentation(master))
  const render = (r: ContentRecord) => `<article>${Object.entries(r.payload).map(([key, value]) => `<div><small>${escape(key)}</small><p>${escape(value ?? 'Not supplied')}</p></div>`).join('')}<footer>${escape(JSON.stringify({ id: r.id, classification: r.classification, verification: r.verification, approval: r.approval, provenance: r.provenance, file: r.file }))}</footer></article>`
  const schedules = Object.entries(view.financialSchedules).map(([name, rows]) => `<section><h2>${name === 'personal' ? 'Personal' : 'Business'} financial schedule</h2>${rows.length ? rows.map(row => `<h3>${escape(row.display)}</h3>${render(row.record)}`).join('') : '<p>No approved figures supplied.</p>'}</section>`).join('')
  const fx = view.exchangeRate
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Private investor presentation</title><style>body{font:12px Arial;margin:32px;color:#111}section{break-before:page}section:first-of-type{break-before:auto}p{white-space:pre-wrap;overflow-wrap:anywhere}footer{font-size:9px;overflow-wrap:anywhere}article{margin-bottom:24px}small{color:#555}</style><body>${view.blocks.map(b => `<section><h1>${b.number === null ? '' : String(b.number).padStart(2, '0') + ' · '}${escape(b.title)}</h1>${b.records.map(render).join('')}</section>`).join('')}<section><h2>Exchange-rate assumption</h2><p>${fx ? escape(`1 GBP = ${fx.zarPerGbp} ZAR; as of ${fx.asOf}; source: ${fx.source}; approved by ${fx.approvedBy} on ${fx.approvedOn}. Converted values rounded to nearest penny/cent; original amounts retained.`) : 'Not supplied; no approved figures.'}</p></section>${schedules}</body></html>`
}
