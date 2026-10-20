export type Disclosure = 'PRIVATE' | 'COMMERCIAL'
export type Verification = 'DEMONSTRATION' | 'PENDING' | 'VERIFIED'
export interface Evidence {
  id: string
  title: string
  description: string
  status: Verification
  source: string | null
}
export interface VaultImage { id: string; caption: string; alt: string; url: string | null; originalFilename?: string; sha256?: string }
export interface VaultDocument {
  id: string
  title: string
  section_id: string
  disclosure: Disclosure
  verification: Verification
  storage_path: string | null
  updated_at: string
}
export interface VaultSection {
  id: string
  number: number
  title: string
  subtitle: string
  overview: string
  narrative: { heading: string; body: string }[]
  evidence: Evidence[]
  images: VaultImage[]
  documents: VaultDocument[]
  updated_at: string
  verification: Verification
  disclosure: Disclosure
}
