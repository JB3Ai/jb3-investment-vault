import {presentationView} from './presentationCopy.ts'
import {commercialDocumentVisible} from './commercialReview.ts'
import type { ContentRecord } from '../../content-migration/ingestion-schema.ts'
import type { ApprovedContent } from './privateContent.ts'
import { brochureAssociation,brochureCategory,brochureDocument,brochureEdition,brochureEntries,type BrochureDocument,type BrochureEntry } from './brochures.ts'
export const portfolioCollections = ['showcase','client-engagements'] as const
export type PortfolioCollection = typeof portfolioCollections[number]
export const portfolioStatuses = ['Concept','Prototype','Proposal','Consulting Completed','Delivered','Contracted'] as const
export type PortfolioStatus = typeof portfolioStatuses[number]
export interface PortfolioDocument extends BrochureDocument {
 collection:PortfolioCollection|'evidence-only';order:number;description:string;status:PortfolioStatus;statusBasis:string;statusEvidenceId:string|null;statusBasisProvided:boolean
 documentDate:string|null;versionLabel:string|null;ownershipNote:string|null;reviewedBy:string|null;reviewedOn:string|null;conflictNote:string|null
}
/** A display projection over existing classified records; never an asset store or access grant. */
export function portfolioDocument(record:ContentRecord|ApprovedContent,metadata:Record<string,string|null>={}):PortfolioDocument {
 if(record.kind!=='pdf')throw Error('Portfolio requires an existing PDF record')
 const document=brochureDocument(record,metadata),category=brochureCategory(document),requested=metadata['portfolio.status']
 const collection=portfolioCollections.find(value=>value===metadata['portfolio.collection'])??(metadata['portfolio.collection']==='evidence-only'||/resume|curriculum|\bcv\b|investor|investment deck|compounding architecture/i.test(document.title+' '+document.originalFilename)?'evidence-only':category==='Client Proposals'?'client-engagements':'showcase')
 const status=portfolioStatuses.find(status=>status===requested)??(/proposal|investor|investment deck/i.test(document.title+' '+document.originalFilename)?'Proposal':'Concept')
 return presentationView({...document,excludedFromCommercial:document.excludedFromCommercial||!commercialDocumentVisible(document),statusBasisProvided:!!metadata['portfolio.statusBasis']?.trim(),title:metadata['portfolio.title']?.trim()||document.title,association:metadata['portfolio.association']?.trim()||brochureAssociation(document),collection,order:Number.isSafeInteger(Number(metadata['portfolio.order']))?Number(metadata['portfolio.order']):100,description:metadata['portfolio.description']?.trim()||'Private presentation and supporting background. Document assertions and commercial outcomes require separate verification.',status,statusBasis:metadata['portfolio.statusBasis']?.trim()||'Document intent only; no completed engagement, deployment or commercial agreement is inferred.',statusEvidenceId:metadata['portfolio.statusEvidenceRecordId']??null,documentDate:metadata['portfolio.documentDate']?.trim()||document.sourceDate,versionLabel:metadata['portfolio.version']?.trim()||brochureEdition(document).label,ownershipNote:metadata['portfolio.ownershipNote']?.trim()||null,reviewedBy:record.provenance.reviewedBy,reviewedOn:record.provenance.reviewedOn,conflictNote:record.provenance.conflictNote})
}
function substantiated(document:PortfolioDocument,documents:PortfolioDocument[]) {
 if(!['Consulting Completed','Delivered','Contracted'].includes(document.status))return document.status!=='Prototype'||document.statusBasisProvided
 const proof=documents.find(proof=>proof.id===document.statusEvidenceId&&proof.id!==document.id)
 return !!proof&&proof.classification===document.classification&&proof.approval==='approved'&&proof.verification==='documented'&&/^[a-f0-9]{64}$/.test(proof.sha256??'')&&!!proof.citation&&!!proof.reviewedBy&&/^\d{4}-\d{2}-\d{2}$/.test(proof.reviewedOn??'')&&proof.conflictNote===null&&document.statusBasisProvided
}
export function portfolioEntries(documents:PortfolioDocument[]):BrochureEntry<PortfolioDocument>[] {
 const families=brochureEntries(documents.filter(document=>document.collection!=='evidence-only'))
 const eligible=brochureEntries(documents).flatMap(family=>family.versions)
 return families.map(family=>({...family,document:substantiated(family.document,eligible)?family.document:{...family.document,status:'Concept' as const,statusBasis:'Claimed commercial status awaits explicit supporting evidence; no completion or contract is inferred.'}})).sort((a,b)=>a.document.order-b.document.order||a.document.title.localeCompare(b.document.title))
}
