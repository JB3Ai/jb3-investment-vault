/** Transport metadata only. Populated evidence instructions stay in private custody. */
export interface LaboratoryEvidenceReview {
  format: 'JB3_LABORATORY_REVIEW_V1'
  classification: 'BRUCE_PRIVATE'
  approval: 'draft'
  verification: 'awaiting-verification'
  sequenceSource: 'founder-provided'
  recordedBy: string
  recordedOn: string
  slots: { position: number; recordId: string | null; originalNumber: number | null; sha256: string | null }[]
  unplaced: { recordId: string; originalNumber: number; sha256: string }[]
  videos: { id: string; url: string; title: null; sourceDate: null; certification: null; classification: 'BRUCE_PRIVATE'; approval: 'draft'; verification: 'awaiting-verification'; sourceReference: string }[]
}
export function youtubeId(url: string): string | null {
  try {
    const value = new URL(url)
    if (value.protocol !== 'https:' || value.username || value.password || value.port || value.hash) return null
    const id = value.hostname === 'youtu.be' ? value.pathname.slice(1) : ['www.youtube.com', 'youtube.com'].includes(value.hostname) && value.pathname === '/watch' ? value.searchParams.get('v') : null
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}
