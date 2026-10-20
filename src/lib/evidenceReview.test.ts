import {describe,it,expect} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {EvidenceReviewCard} from '../components/EvidenceReviewCard'
import type {ContentRecord} from '../../content-migration/ingestion-schema'
import type {EvidenceReview} from './localReview'
describe('metadata-only draft evidence card',()=>{
 it('shows classification and qualified findings without a PDF action or unsafe HTML',()=>{
 const record:ContentRecord={id:'synthetic',kind:'pdf',classification:'LEGAL_RESTRICTED',verification:'awaiting-verification',approval:'draft',payload:{title:'Synthetic source'},provenance:{originalFilename:'synthetic.pdf',sourceDate:null,citation:'p. 1',sourceReference:'sha256:synthetic',reviewedBy:null,reviewedOn:null,conflictNote:'Unresolved'},file:null}
 const review:EvidenceReview={recordId:record.id,sectionIds:['current-position'],pageCount:1,metadata:{author:null},summary:'<script>synthetic</script>',assertions:['Reported only'],independentlyVerifiedFacts:['Local file verification only'],verificationHolds:['Owner review pending'],downloadAllowed:false,reviewStatus:'DRAFT / OWNER REVIEW REQUIRED'}
 const html=renderToStaticMarkup(createElement(EvidenceReviewCard,{record,review}))
 expect(html).toContain('LEGAL_RESTRICTED');expect(html).toContain('DRAFT EVIDENCE / OUTSTANDING VERIFICATION');expect(html).toContain('Sections 02');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('<button');expect(html).not.toContain('href=');expect(html).toContain('access withheld');expect(html).toContain('assertions / allegations');expect(html).toContain('Independently verified facts')
 })
})
