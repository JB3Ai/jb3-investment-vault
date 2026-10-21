import type {OwnerAssetEstimates} from '../lib/assetReview'
import {ownerEstimateRange} from '../lib/assetReview'
import {BriefingMarkdown} from './BriefingMarkdown'
const millions=(minor:number)=>new Intl.NumberFormat('en-ZA',{maximumFractionDigits:2}).format(minor/100000000)
export function OwnerAssetRegister({estimates}:{estimates:OwnerAssetEstimates}){
 const total=ownerEstimateRange(estimates),range=(low:number,high:number)=>'R'+millions(low)+'–'+millions(high)+'m'
 return <section className="owner-asset-estimates" aria-label={estimates.heading}>
  <h3>{estimates.heading}</h3><p className="metadata">{estimates.subtitle}</p>
  <div className="asset-review-grid owner-range-grid">{estimates.entries.map(entry=><article key={entry.key}><h4>{entry.label}</h4><strong>{range(entry.lowMinor,entry.highMinor)}</strong><p>{entry.note}</p></article>)}</div>
  <div className="owner-range-total"><span>Combined indicative range</span><strong>{range(total.lowMinor,total.highMinor)}</strong><p>{estimates.combinedNote}</p></div>
  <p className="module-note">{estimates.rangeNote}</p><p>{estimates.ipNote}</p>
  <p className="module-note">Owner: {estimates.owner} / {estimates.recordedOn} / Reported estimate, not independently verified.</p>
 </section>
}
export function OwnerAssetBriefing({estimates}:{estimates:OwnerAssetEstimates}){
 return <div className="owner-asset-briefing" aria-label={estimates.briefing.heading}><h3>{estimates.briefing.heading}</h3>{estimates.briefing.paragraphs.map((body,index)=><BriefingMarkdown key={index} body={body}/>)}</div>
}
