export const commercialDisclosure='Commercial opportunities are indicative and subject to agreement. No signed revenue commitments are assumed in the base funding model.'
export const reportStartingPrices=[['Digital Presence Scorecard',3999],['Competitive Intelligence Report',4999],['AI Visibility Audit',4999],['Search Opportunity Report',4999],['Website Performance & Conversion Review',4999],['Brand & Reputation Snapshot',4999],['Industry Landscape Brief',4999]] as const
export const reportPricingSource='JB³ Business Intelligence Reports 2026. Published starting prices supplied by Jonathan Blackburn on 21 October 2026; catalogue PDF association pending. Prices exclude VAT. Bundles are quoted separately.'
export interface CommercialScenarioInput{consultingCount:number;consultingFee:number;reportCount:number;reportFee:number}
export function commercialScenario(input:CommercialScenarioInput){
 if(![input.consultingCount,input.reportCount].every(n=>Number.isInteger(n)&&n>=0&&n<=1000)||![input.consultingFee,input.reportFee].every(n=>Number.isFinite(n)&&n>=0&&n<=100000000))return null
 const consultingMinor=input.consultingCount*Math.round(input.consultingFee*100),reportsMinor=input.reportCount*Math.round(input.reportFee*100),monthlyMinor=consultingMinor+reportsMinor
 return{consultingMinor,reportsMinor,monthlyMinor,annualMinor:monthlyMinor*12}
}
