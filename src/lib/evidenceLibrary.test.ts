import {it,expect} from 'vitest'
import {evidenceGroups,evidenceCategory} from './evidenceLibrary'
import type {ContentRecord} from '../../content-migration/ingestion-schema'
import type {EvidenceReview} from './localReview'
const pdf=(id:string,classification:ContentRecord['classification']='BRUCE_PRIVATE'):ContentRecord=>({
  id,kind:'pdf',classification,approval:'draft',verification:'awaiting-verification',
  payload:{title:'Synthetic document'},
  file:{relativePath:'sources/synthetic/document.pdf',sha256:'a'.repeat(64),mimeType:'application/pdf'},
  provenance:{originalFilename:'synthetic.pdf',sourceDate:null,citation:'Synthetic p.1',sourceReference:'Synthetic source',reviewedBy:null,reviewedOn:null,conflictNote:null},
})
const review=(recordId:string,category:string):EvidenceReview=>({
  recordId,sectionIds:[],pageCount:1,metadata:{'documents.category':category},summary:'Synthetic review',
  assertions:[],independentlyVerifiedFacts:[],verificationHolds:[],downloadAllowed:false,reviewStatus:'DRAFT / OWNER REVIEW REQUIRED',
})
it('groups four legal records together independently of ordinary categories',()=>{const records=['one','two','three','four'].map(id=>pdf(id,'LEGAL_RESTRICTED'));expect(evidenceGroups(records).find(([name])=>name==='Legal & supporting records')?.[1]).toHaveLength(4);expect(evidenceCategory(records[0],review('one','founder-profile'))).toBe('Legal & supporting records')})
it('separates founder credentials, technical assets and hardware without changing records',()=>{const records=[pdf('cv'),pdf('audit'),pdf('hardware')],before=JSON.stringify(records);const groups=evidenceGroups(records,[review('cv','founder-profile'),review('audit','technical-assets'),review('hardware','hardware-investment')]);expect(groups.find(([name])=>name==='Founder Profile & Credentials')?.[1][0].id).toBe('cv');expect(groups.find(([name])=>name==='Technical Assets')?.[1][0].id).toBe('audit');expect(groups.find(([name])=>name==='Financial Requirements')?.[1][0].id).toBe('hardware');expect(JSON.stringify(records)).toBe(before)})
