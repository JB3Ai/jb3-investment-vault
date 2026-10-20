import { demoSections } from '../content/registry'
import type { VaultSection } from '../types'
// Chapter furniture only, without synthetic or confidential records.
export const presentationSections: VaultSection[] = demoSections.map(({ id, number, title, subtitle }) => ({
  id, number, title, subtitle, overview: '', narrative: [], evidence: [], images: [], documents: [],
  updated_at: '2026-10-13', verification: 'PENDING', disclosure: 'PRIVATE',
}))
