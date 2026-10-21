import {narrativeBlocks} from './narrativePresentation.ts'
import {presentationView} from './presentationCopy.ts'
import type {VaultSection} from '../types'
import type {OwnerAssetEstimates} from './assetReview.ts'
export const briefingEmail='mailto:?subject='+encodeURIComponent('JB³ Private Investment Briefing')+'&body='+encodeURIComponent('I am sharing the JB³ private investment briefing. You can review the presentation here:\n\nhttps://bruce.jb3ai.com\n\nSupporting material retains its recorded permissions and verification status.')
/** Read only displayed briefing copy; no navigation, provenance or footer metadata. */
export function briefingReadTime(source:VaultSection[],assetEstimates?:OwnerAssetEstimates){
 const sections=presentationView(source),demo=sections.every(section=>section.verification==='DEMONSTRATION'),parts=['Executive briefing.','Jonathan Blackburn / JB³','Proposed strategic relationship with Beobacht.']
 function content(body:string){for(const block of narrativeBlocks(body)){if(block.type==='rule')continue;parts.push(...(block.type==='table'?[...block.headers,...block.rows.flat()]:block.type==='list'?block.items:[block.body]))}}
 for(const section of sections){parts.push(!demo&&section.narrative[0]?.heading?section.narrative[0].heading:section.title);if(section.overview)parts.push(section.overview);for(const item of section.narrative)content(item.body);if(section.id==='assets-claims'&&assetEstimates){parts.push(assetEstimates.briefing.heading);assetEstimates.briefing.paragraphs.forEach(content)}}
 const words=parts.join(' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length??0
 return {words,minutes:Math.ceil(words/220)}
}
