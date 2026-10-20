import { orderedFinancialRows, fundingRow, fundingSummary } from '../src/lib/fundingProposal.ts'
import type { FinancialData, ExportScope } from '../src/lib/financialSchedules.ts'
const safe=(value:string)=>/^[=+@-]/.test(value)?"'"+value:value
const labels={'included-in-household':'Included in household','additional-one-off':'Separate one-off','essential-business':'Essential business','conditional-business':'Conditional business','optional-hardware':'Optional hardware'}
/** Extends the existing workbook; all original source rows and their formulas remain. */
export function applyFundingWorkbook(wb:any,data:FinancialData,scope:ExportScope){
 if(!data.funding)return
 const p=data.funding,personal=scope!=='business',business=scope!=='personal',assumptions=wb.worksheets.getItem('Assumptions'),comparison=wb.worksheets.getItem('Budget scenarios'),summary=wb.worksheets.getItem('Summary'),sources=wb.worksheets.getItem('Source notes')
 const schedules=scope==='combined'?['personal','business'] as const:[scope]
 let sourceRow=3
 sources.getRange('U2:W2').values=[['Current funding treatment / status','Urgency','Owner funding note']]
 for(const name of schedules){const title=name==='personal'?'Personal':'Business',sheet=wb.worksheets.getItem(title),rows=orderedFinancialRows(data,data[name]),last=rows.length+4
  sheet.getRange('F4').values=[['Source category']];sheet.getRange('F5:F'+last).setNumberFormat('  @');sheet.getRange('H4:I4').values=[['Funding treatment','Status / urgency']]
  sheet.getRange('H5:I'+last).values=rows.map(record=>{const meta=fundingRow(data,record)!;return [labels[meta.treatment],meta.status+' / '+meta.urgency]})
  sheet.getRange('H1:I40').format.columnWidth=31
  sheet.getRange('A4:I4').format={fill:'#292C29',font:{bold:true,color:'#FFFFFF'},rowHeight:30,wrapText:true}
  sheet.getRange('A5:I'+last).format.rowHeight=38;sheet.getRange('A5:A'+last).format.wrapText=true;sheet.getRange('H5:I'+last).format.wrapText=true
  for(const record of rows){const meta=fundingRow(data,record)!;sources.getRange('U'+sourceRow+':W'+sourceRow).values=[[labels[meta.treatment]+' / '+meta.status,meta.urgency,safe(meta.note)]];sourceRow++}
 }
 sources.getRange('U3:W'+(sourceRow-1)).format.wrapText=true;sources.getRange('U3:W'+(sourceRow-1)).format.rowHeight=72
 sources.getRange('U2:W2').format={fill:'#292C29',font:{bold:true,color:'#FFFFFF'}};sources.getRange('U1:V'+sourceRow).format.columnWidth=40;sources.getRange('W1:W'+sourceRow).format.columnWidth=96
 const personalLast=data.personal.length+4,businessLast=data.business.length+4
 if(personal){
  assumptions.getRange('A24:B32').values=[['Household essentials monthly ZAR',p.household.essentialsMonthlyMinor/100],['Monthly allowance / buffer ZAR',p.household.bufferMonthlyMinor/100],['Minimum household monthly ZAR',null],['Household treatment','Replaces corresponding recurring source detail; never added to it.'],['Owner / proposal date',safe(p.owner+' / '+p.recordedOn)],['Household inclusions',safe(p.household.inclusions?.join(', ')??'See owner proposal')],['Record approval','DRAFT / reconciliation outstanding'],['Owner instruction filename',safe(p.source.originalFilename)],['Owner instruction SHA-256',p.source.sha256]]
  assumptions.getRange('B26').formulas=[['=SUM(B24:B25)']];assumptions.getRange('A33:A34').values=[['Itemised recurring detail ZAR'],['Essentials estimate less itemised ZAR']];assumptions.getRange('B33:B34').formulas=[['=SUM(Personal!C5:C'+personalLast+')'],['=B24-B33']]
  assumptions.getRange('B24:B25').format.fill='#FFF1CA';assumptions.getRange('B24:B25').format.font.color='#0000FF';assumptions.getRange('B24:B26').setNumberFormat('#,##0.00;(#,##0.00);"-"');assumptions.getRange('A24:A34').format.columnWidth=35
  comparison.getRange('A21:D21').values=[['Household month','ZAR','GBP','Status']]
  p.household.periods.forEach((period,index)=>{const row=22+index;comparison.getRange('A'+row).values=[[(Date.parse(period+'-01T00:00:00Z')-Date.UTC(1899,11,30))/86400000]];comparison.getRange('B'+row+':C'+row).formulas=[['=Assumptions!$B$26','=ROUND(B'+row+'/Assumptions!$B$2,2)']];comparison.getRange('D'+row).values=[['Owner proposal / draft']]})
  comparison.getRange('A27').values=[['Five-month household total']];comparison.getRange('B27:C27').formulas=[['=SUM(B22:B26)','=ROUND(B27/Assumptions!$B$2,2)']]
  comparison.getRange('A22:A26').setNumberFormat('mmmm yyyy');comparison.getRange('A22:A26').format.horizontalAlignment='left';comparison.getRange('B21:C21').format.horizontalAlignment='right';comparison.getRange('B22:C27').setNumberFormat('#,##0.00;(#,##0.00);"-"');comparison.getRange('A21:D21').format={fill:'#292C29',font:{bold:true,color:'#FFFFFF'}};comparison.getRange('A27:D27').format.fill='#EEE9DF'
 }
 if(business){assumptions.getRange('A37:B40').values=[['Client travel monthly minimum ZAR',p.business.travelMonthlyMinMinor/100],['Client travel monthly maximum ZAR',p.business.travelMonthlyMaxMinor/100],['Travel condition','Only additional paid-project travel; excluded from core requirement.'],['Connectivity / office condition','Avoid household overlap. Office, staff and corporate services need a formal arrangement.']];assumptions.getRange('B37:B38').setNumberFormat('#,##0.00')}
 comparison.getRange('A3').values=[['Household + essential business ZAR']]
 comparison.getRange('B10').formulas=[[personal?'=SUMIF(Personal!H5:H'+personalLast+',"Separate one-off",Personal!D5:D'+personalLast+')':'=0']]
 comparison.getRange('B11').formulas=[[business?'=SUMIF(Business!H5:H'+businessLast+',"Essential business",Business!D5:D'+businessLast+')':'=0']]
 comparison.getRange('B3').formulas=[[personal?'=B27+B11':'=B11']]
 comparison.getRange('A18:A19').values=[['Core plus known one-offs ZAR'],['Core plus known one-offs GBP']];comparison.getRange('B18:B19').formulas=[['=SUM(B3,B10)'],['=ROUND(B18/Assumptions!$B$2,2)']]
 comparison.getRange('A15').values=[['Household replaces its recurring source budget. One-offs are separate; unknown amounts and conditional costs are excluded, not zero.']]
 comparison.getRange('A16').values=[['All source rows remain draft. Safety-critical brakes and medical needs are not discretionary. Historical quotes need current confirmation.']]
 comparison.getRange('A1:A27').format.columnWidth=48;comparison.getRange('B1:B27').format.columnWidth=27;comparison.getRange('C1:C27').format.columnWidth=22;comparison.getRange('D1:D27').format.columnWidth=28;comparison.getRange('A3:A19').format.wrapText=true;comparison.getRange('A3:B19').format.rowHeight=30
 comparison.getRange('B3:B3').setNumberFormat('#,##0.00');comparison.getRange('B10:B13').setNumberFormat('#,##0.00');comparison.getRange('B18:B19').setNumberFormat('#,##0.00')
 summary.getRange('B5').values=[['Source detail ZAR']];summary.getRange('C13').values=[['Unresolved']];summary.getRange('C13').format.horizontalAlignment='right';summary.getRange('A5').values=[['Supporting source detail (not additional)']];summary.getRange('A10').values=[['Household + essential business']];summary.getRange('A11').values=[['Hardware source items - separate decision']];summary.getRange('A12').values=[['Indicative core + known one-offs']];summary.getRange('A14').values=[['Known one-offs included in row 12']]
 summary.getRange('B10:C10').formulas=[["='Budget scenarios'!B3",'=ROUND(B10/Assumptions!$B$2,2)']];summary.getRange('B12:C12').formulas=[["='Budget scenarios'!B18",'=ROUND(B12/Assumptions!$B$2,2)']];summary.getRange('B14:C14').formulas=[["='Budget scenarios'!B10",'=ROUND(B14/Assumptions!$B$2,2)']]
 summary.getRange('A15').values=[['Unknown amounts are excluded, not zero. Historical quotes and provisional one-offs require reconciliation.']];summary.getRange('A17').values=[['Optional hardware stages and conditional business costs are outside the core requirement. No revenue or disputed recovery assumed.']];summary.getRange('A5:A14').format.wrapText=true;summary.getRange('A5:D14').format.rowHeight=32;summary.getRange('B14:C14').setNumberFormat('#,##0.00')
 const expected=fundingSummary({...data,personal:personal?data.personal:[],business:business?data.business:[]})!
 return expected
}
