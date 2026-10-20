import {describe,it,expect} from 'vitest'
import {blankManifest, type ContentRecord} from '../content-migration/ingestion-schema'
import {stageRows} from '../content-migration/local-importer'
import {supportingEvidenceReview,localAssetAllowed} from './supportingEvidence'
const id='10000000-0000-4000-8000-000000000001',old='10000000-0000-4000-8000-000000000002'
function fixture(){
 const manifest=blankManifest()
 const record:ContentRecord={id,kind:'pdf',classification:'LEGAL_RESTRICTED',verification:'awaiting-verification',approval:'draft',provenance:{originalFilename:'synthetic.pdf',sourceDate:null,citation:'p. 1',sourceReference:'sha256:'+ 'a'.repeat(64),reviewedBy:null,reviewedOn:null,conflictNote:'Synthetic unresolved assertion'},payload:{title:'Synthetic evidence'},file:{relativePath:'sources/current-position/synthetic.pdf',sha256:'a'.repeat(64),mimeType:'application/pdf'}}
 manifest.sections[1].records.push(record);manifest.sections[2].records.push({...record,id:old,classification:'BRUCE_PRIVATE'})
 const entry={recordId:id,sourcePath:'C:/private/synthetic.pdf',sha256:'a'.repeat(64),sectionIds:['current-position'],pageCount:1,metadata:{title:null},summary:'Synthetic summary',assertions:['Source assertion only'],independentlyVerifiedFacts:['Hash verified locally; no substantive verification'],verificationHolds:['Owner review pending'],downloadAllowed:false,reviewStatus:'DRAFT / OWNER REVIEW REQUIRED'}
 return {manifest,record,entry,input:{format:'JB3_SUPPORTING_EVIDENCE_REVIEW_V1',records:[entry],legacyLocalPreviewIds:[old]}}
}
describe('existing supporting evidence intake annotations',()=>{
 it('references existing draft UUIDs without changing records or granting new access',()=>{const f=fixture(),before=JSON.stringify(f.manifest),result=supportingEvidenceReview(f.input,f.manifest);expect(result.reviews).toHaveLength(1);expect(result.allowed).toEqual([old]);expect(JSON.stringify(f.manifest)).toBe(before);expect(stageRows(f.manifest)).toEqual([])})
 it('keeps original absolute custody paths out of the review transport',()=>{const f=fixture();const text=JSON.stringify(supportingEvidenceReview(f.input,f.manifest).reviews);expect(text).not.toContain('C:/private');expect(text).not.toContain('sourcePath')})
 it.each(['download','hash','missing','association','approval','classification'])('rejects unsafe or mismatched annotation: %s',kind=>{const f=fixture();if(kind==='download')f.input.legacyLocalPreviewIds.push(id);if(kind==='hash')f.entry.sha256='b'.repeat(64);if(kind==='missing')f.entry.recordId='10000000-0000-4000-8000-000000000099';if(kind==='association')f.entry.sectionIds=['assets-claims'];if(kind==='approval')f.record.approval='approved';if(kind==='classification')f.record.classification='COMMERCIAL';expect(()=>supportingEvidenceReview(f.input,f.manifest)).toThrow()})
 it('does not allow duplicate annotations or invented section references',()=>{const f=fixture();f.input.records.push(f.entry);expect(()=>supportingEvidenceReview(f.input,f.manifest)).toThrow();f.input.records.pop();f.entry.sectionIds.push('invented');expect(()=>supportingEvidenceReview(f.input,f.manifest)).toThrow()})
 it('fails closed for every non-allowlisted PDF, independently of record visibility',()=>{expect(localAssetAllowed(id,'pdf',[old])).toBe(false);expect(localAssetAllowed(id,'pdf',[])).toBe(false);expect(localAssetAllowed(old,'pdf',[old])).toBe(true);expect(localAssetAllowed(id,'photograph',[])).toBe(true);expect(localAssetAllowed(id,'other',[id])).toBe(false)})
})

it('allows only hash-bound owner-local preview requests for reviewed Bruce-private drafts',()=>{
 const f=fixture();f.record.classification='BRUCE_PRIVATE'
 const input={...f.input,ownerLocalPreview:[{recordId:id,sha256:'a'.repeat(64),scope:'loopback-owner-review-only',requestedBy:'Synthetic owner',recordedOn:'2026-10-19'}]}
 expect(supportingEvidenceReview(input,f.manifest).allowed).toEqual([old,id])
 expect(stageRows(f.manifest)).toEqual([])
 input.ownerLocalPreview[0].sha256='b'.repeat(64);expect(()=>supportingEvidenceReview(input,f.manifest)).toThrow()
 input.ownerLocalPreview[0].sha256='a'.repeat(64);f.record.classification='LEGAL_RESTRICTED';expect(()=>supportingEvidenceReview(input,f.manifest)).toThrow()
})
