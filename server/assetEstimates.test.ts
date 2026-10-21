import {it,expect} from 'vitest'
import {parseOwnerAssetEstimates} from './assetReview'
import {ownerEstimateRange,type OwnerAssetEstimates} from '../src/lib/assetReview'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {OwnerAssetRegister,OwnerAssetBriefing} from '../src/components/OwnerAssetEstimates'
function fixture():OwnerAssetEstimates{return {
 classification:'BRUCE_PRIVATE',verification:'reported',owner:'Synthetic owner',recordedOn:'2026-01-01',
 source:{relativePath:'sources/synthetic/estimates.json',originalFilename:'estimates.json',sha256:'a'.repeat(64)},
 heading:'Synthetic owner estimate register',subtitle:'Owner estimates only',combinedNote:'Arithmetic sum, not available cash or verified valuation.',rangeNote:'Ranges are not expected proceeds.',ipNote:'Ownership and valuation require verification.',
 entries:[{key:'micore',label:'Synthetic recovery A',lowMinor:100,highMinor:300,note:'Disputed'},{key:'kula',label:'Synthetic recovery B',lowMinor:400,highMinor:800,note:'Dormant'},{key:'code',label:'Synthetic IP',lowMinor:200,highMinor:500,note:'Ownership unverified'}],
 briefing:{heading:'Synthetic supplementary briefing',paragraphs:['An **owner estimate** is not cash.','Funding does not depend on recovery.']},
}}
it('computes only an indicative arithmetic range without mutating inputs or creating a model contribution',()=>{const value=fixture(),before=JSON.stringify(value);expect(ownerEstimateRange(value)).toEqual({lowMinor:700,highMinor:1600});expect(JSON.stringify(value)).toBe(before);expect(value).not.toHaveProperty('modelContributionMinor')})
it.each(['reversed','negative','fraction','duplicate','classification','verified','date','source'])('rejects invalid or promoted owner estimates: %s',reason=>{const value=fixture();if(reason==='reversed')value.entries[0].lowMinor=400;if(reason==='negative')value.entries[0].highMinor=-1;if(reason==='fraction')value.entries[0].highMinor=1.5;if(reason==='duplicate')value.entries[1].key='micore';if(reason==='classification')Object.assign(value,{classification:'LEGAL_RESTRICTED'});if(reason==='verified')Object.assign(value,{verification:'documented'});if(reason==='date')value.recordedOn='2026-02-31';if(reason==='source')value.source.sha256='invalid';expect(()=>parseOwnerAssetEstimates(value)).toThrow()})
it('renders labelled ranges and briefing paragraphs from private data without exposing source paths',()=>{const value=fixture(),register=renderToStaticMarkup(createElement(OwnerAssetRegister,{estimates:value})),briefing=renderToStaticMarkup(createElement(OwnerAssetBriefing,{estimates:value}));expect(register).toContain(value.combinedNote);expect(register).toContain('not independently verified');expect(register).not.toContain(value.source.relativePath);expect(briefing.match(/<p(?:\s|>)/g)).toHaveLength(2);expect(briefing).toContain('<strong>owner estimate</strong>')})
