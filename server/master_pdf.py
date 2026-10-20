"""Private server-side PDF. Input via stdin, PDF bytes via stdout; no public files."""
import io, json, re, sys, os
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, NextPageTemplate, Table, TableStyle, Image, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

data=json.load(sys.stdin)
for name,file in [('Body','arial.ttf'),('Bold','arialbd.ttf'),('Editorial','georgia.ttf'),('EditorialBold','georgiab.ttf')]:
    pdfmetrics.registerFont(TTFont(name,os.path.join(os.environ.get('WINDIR','C:/Windows'),'Fonts',file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
pdfmetrics.registerFontFamily('Editorial',normal='Editorial',bold='EditorialBold',italic='Editorial',boldItalic='EditorialBold')
pdfmetrics.registerFontFamily('EditorialBold',normal='EditorialBold',bold='EditorialBold',italic='EditorialBold',boldItalic='EditorialBold')
ink=colors.HexColor('#242923'); amber=colors.HexColor('#b89b65'); muted=colors.HexColor('#66675e')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=11,leading=17,spaceAfter=9,textColor=ink,allowWidows=0,allowOrphans=0),
 'h1':ParagraphStyle('h1',fontName='Editorial',fontSize=24,leading=30,spaceAfter=18,keepWithNext=True,textColor=ink),
 'h2':ParagraphStyle('h2',fontName='EditorialBold',fontSize=15,leading=21,spaceBefore=12,spaceAfter=9,keepWithNext=True,textColor=ink),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8,leading=11,spaceAfter=7,textColor=muted),
 'table':ParagraphStyle('table',fontName='Body',fontSize=8.5,leading=12,textColor=ink),
 'cover':ParagraphStyle('cover',fontName='Editorial',fontSize=35,leading=44,textColor=colors.HexColor('#e8d5b5'),spaceAfter=24),
 'coverSmall':ParagraphStyle('coverSmall',fontName='Body',fontSize=12,leading=20,textColor=colors.HexColor('#c9c3b6'),spaceAfter=16),
}
styles['category']=ParagraphStyle('category',parent=styles['small'],keepWithNext=True)
styles['tableRight']=ParagraphStyle('tableRight',parent=styles['table'],alignment=2)

def text(value):return escape(str(value))
def rich(value):
    value=text(value)
    value=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',value)
    value=re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)',r'<i>\1</i>',value)
    return value.replace('\n','<br/>')
def p(value,style='body'):return Paragraph(rich(value),styles[style])
def money(minor,currency='ZAR'):
    value=Decimal(str(minor))/100
    if currency=='GBP':value=value/Decimal(str(data['finances']['rate']))
    value=value.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
    return ('ZAR ' if currency=='ZAR' else 'GBP ')+format(value,',.2f')
def narrative(body):
    flow=[]; pending=[]
    def flush():
        if pending:flow.append(p('\n'.join(pending)));pending.clear()
    for line in body.replace('\r\n','\n').split('\n'):
        heading=re.match(r'^#{1,6}\s+(.+)$',line)
        if not line.strip():flush()
        elif heading:flush();flow.append(p(heading[1],'h2'))
        elif re.match(r'^---+$',line.strip()):flush();flow.append(Spacer(1,8))
        else:pending.append(line)
    flush();return flow
def table(headers,rows,widths):
    numeric={index for index,label in enumerate(headers) if index and re.search(r'ZAR|GBP',label)}
    content=[[p(v,'tableRight' if index in numeric else 'table') for index,v in enumerate(headers)]]+[[p('Awaiting confirmation' if v is None else v,'tableRight' if index in numeric else 'table') for index,v in enumerate(row)] for row in rows]
    item=Table(content,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1)
    item.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8e3d5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,amber),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#ddd8ca')),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]));return item
def cover(c,doc):
    c.saveState();c.setFillColor(colors.HexColor('#151714'));c.rect(0,0,*A4,fill=1,stroke=0);c.setStrokeColor(amber);c.setLineWidth(.6);c.line(48,740,547,740);c.line(48,80,547,80);c.restoreState()
def page(c,doc):
    c.saveState();c.setFillColor(muted);c.setFont('Body',8);c.drawString(48,28,'CONFIDENTIAL / BRUCE BLACKBURN');c.drawRightString(A4[0]-48,28,str(doc.page));c.setStrokeColor(amber);c.setLineWidth(.3);c.line(48,43,A4[0]-48,43);c.restoreState()
class Document(BaseDocTemplate):
    def afterFlowable(self,flowable):
        if getattr(flowable,'toc_key',None):
            self.canv.bookmarkPage(flowable.toc_key)
            self.canv.addOutlineEntry(flowable.toc_title,flowable.toc_key,0,False)
            self.notify('TOCEntry',(0,flowable.toc_title,self.page,flowable.toc_key))
output=io.BytesIO();doc=Document(output,pagesize=A4,leftMargin=48,rightMargin=48,topMargin=52,bottomMargin=58,title='JB³ Private Investment Vault',author='Jonathan Blackburn')
frame=Frame(48,58,A4[0]-96,A4[1]-110,id='normal',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates([PageTemplate(id='Cover',frames=[frame],onPage=cover),PageTemplate(id='Body',frames=[frame],onPage=page)])
story=[Spacer(1,125),p('JB³\nPRIVATE INVESTMENT\nVAULT','cover'),p('Prepared exclusively for Bruce Blackburn','coverSmall'),p('Jonathan Blackburn / JB³','coverSmall'),Spacer(1,42),p('PRIVATE OWNER-REVIEW MASTER\nApproved narratives with clearly labelled provisional financial estimates and draft supporting evidence. No agreed funding or repayment terms.','coverSmall'),NextPageTemplate('Body'),PageBreak(),p('Contents','h1')]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Body',fontSize=10.5,leading=17,leftIndent=0,firstLineIndent=0,spaceBefore=6,textColor=ink)];story += [toc,PageBreak()]
counter=0
def title(value):
    global counter
    counter+=1;item=p(value,'h1');item.toc_key='section-'+str(counter);item.toc_title=value;story.append(item)
for index,section in enumerate(data['sections']):
    if index:story.append(PageBreak())
    record=section['narrative'];title(record['payload']['heading']);story.extend(narrative(record['payload']['body']))
    story.append(p('Narrative approval: '+record['approval']+' / account: '+record['classification']+' / verification: '+record['verification'],'small'))
    if index==2:
        story.append(PageBreak());title(data['laboratory']['title']+': draft evidence')
        story.append(p('BRUCE_PRIVATE / DRAFT. Founder-provided display sequence is not independently verified chronology. Recording dates, construction chronology and certification remain unverified. Positions awaiting confirmation: '+', '.join(map(str,data['laboratory']['pending']))+'.'))
        for record in data['laboratory']['records']:story.extend(narrative(record['payload']['body']))
        for image in data['laboratory']['images']:
            label=('Position '+str(image['position']) if image['position'] is not None else 'Unplaced original')+' / original photo '+str(image['originalNumber'])+' / DRAFT'
            picture=Image(image['path']);scale=min((A4[0]-96)/picture.imageWidth,215/picture.imageHeight);picture.drawWidth=picture.imageWidth*scale;picture.drawHeight=picture.imageHeight*scale
            story.append(KeepTogether([p(label,'h2'),picture,Spacer(1,7),p(image['caption'],'small'),p('Original file: '+image['filename']+' / SHA-256 '+image['sha256'],'small')]))
        story.append(p('Original video evidence','h2'))
        for index,video in enumerate(data['laboratory']['videos']):story.append(p('Original video '+str(index+1)+' / BRUCE_PRIVATE / DRAFT\n'+video['url']+'\nTitles, dates, recording content and certification are not independently verified.','small'))
    if index==3 and data.get('hasAssetReview'):
        story.append(PageBreak());title('Assets & Potential Recoveries - draft owner review')
        story.append(p('All entries remain draft. No monetary valuation is inferred from repository activity. Disputed recoveries contribute ZAR 0 to the funding and repayment model until realised. This is a conservative assumption, not a verified asset balance.'))
        story.append(p('Restricted legal entries and their metadata are excluded from this document. Separate legal authorisation is required. Custody proceedings are not financial recovery assets.'))
        for asset in data.get('assets',[]):
            story.append(p(asset['title'],'h2'))
            available='No verified amount supplied' if asset['verifiedAvailableMinor'] is None else money(asset['verifiedAvailableMinor'])
            rows=[['Claimed value','Not verified / not valued' if asset['claimedValueMinor'] is None else money(asset['claimedValueMinor'])],['Valuation basis',asset['valuationBasis']],['Ownership evidence',asset['ownershipEvidence']],['Encumbrances / creditor rights',asset['encumbrances']],['Court / claim stage',asset['claimStage']],['Verified next hearing',asset['nextHearing'] or 'No verified date supplied'],['Potential recovery','No defensible estimate supplied' if asset['recoveryEstimateMinor'] is None else money(asset['recoveryEstimateMinor'])],['Verified currently available',available],['Funding model contribution','ZAR 0 assumed until realised']]
            story.append(table(['Item','Review status'],rows,[160,339]))
            for note in asset['verificationNotes']:story.append(p(note,'small'))
            for source in asset.get('sourceReferences',[]):story.append(p('Review source: '+source['filename']+' / '+source['citation']+' / '+source['approval']+' / '+source['verification']+' / SHA-256 '+str(source['sha256']),'small'))
    if index==6 and data.get('commercial'):
        story.append(PageBreak());commercial=data['commercial']
        story.append(p('Commercial Capability & Opportunity Register','h2'))
        story.append(p('Owner-confirmed positioning / draft supporting evidence. Uncontracted forecast contribution: '+money(commercial['forecastMinor'])+'. No verified customer payments or contracted revenue are asserted. Proposed amounts are not funding or repayment capacity.'))
        for entry in commercial['entries']:
            story.append(p(entry['title'],'h2'));story.append(p(entry['categoryLabel'],'category'));story.append(p(entry['positioning']))
            for limit in entry['limitations']:story.append(p(limit,'small'))
            if entry.get('thirdPartyIp'):story.append(p(entry['ownershipNote'],'small'))
            for source in entry['sourceDocuments']:
                label=source['filename']+' / '+source['citation']+' / '+source['approval']+' / '+source['verification']
                if source['inAppendix']:
                    story.append(Paragraph('<link href="#doc-'+text(source['recordId'])+'" color="#806537">'+text(label)+'</link>',styles['small']))
                else:story.append(p(label+' / source-file access withheld','small'))
            for note in entry['missingEvidence']:story.append(p(note,'small'))
            for quote in entry['quotedValues']:story.append(p('Historical quoted / proposed value only: '+quote['currency']+' '+format(Decimal(str(quote['amountMinor']))/100,',.2f')+' / '+quote['citation']+' / excluded from revenue and funding.','small'))
        story.append(p('Owner clarification: '+commercial['owner']+' / '+commercial['recordedOn']+'. No full technical decks are embedded. Supporting files remain subject to separate classified access and owner approval.','small'))

story.append(PageBreak());title('Financial summary: provisional')
finance=data['finances'];all_totals=finance['all'];scenario=finance['scenarios']
story.append(p('Five-month minimum stabilisation estimates, not a final loan request or verified obligations. Unknown amounts and optional hardware are excluded from the operating baseline. Personal and business calendar periods are not confirmed as aligned.'))
funding=finance.get('funding');proposal=finance.get('proposal')
if funding and proposal:
    story.append(p('Household support replaces the corresponding itemised recurring source budget. The source detail is retained for reconciliation, never added twice.'))
    story.append(p('Estimated essentials: '+money(proposal['household']['essentialsMonthlyMinor'])+' monthly. Allowance / buffer: '+money(proposal['household']['bufferMonthlyMinor'])+'. Owner-confirmed minimum proposal: '+money(proposal['household']['minimumMonthlyMinor'])+' monthly. All component amounts remain working estimates.'))
    story.append(p('Included household costs: '+', '.join(proposal['household'].get('inclusions',[]))+'.'))
    monthly=proposal['household']['minimumMonthlyMinor']
    months=[[date.fromisoformat(period+'-01').strftime('%B %Y'),money(monthly),money(monthly,'GBP')] for period in proposal['household']['periods']]
    months.append(['Five-month household total',money(funding['householdMinor']),money(funding['householdMinor'],'GBP')])
    story.append(table(['Household month','ZAR primary','GBP secondary'],months,[245,125,129]))
    summary=[['Essential business operations',funding['businessMinor']],['Household + essential business',funding['coreMinor']],['Known personal one-off estimates',funding['oneOffMinor']],['Indicative core + known one-offs',funding['knownRequirementsMinor']],['Hardware source items - separate decision',funding['optionalMinor']]]
    story.append(table(['Scope','ZAR primary','GBP secondary'],[[label,money(value),money(value,'GBP')] for label,value in summary],[245,125,129]))
    story.append(p('Known one-offs include provisional amounts and historical quotes, not approved obligations. School fees, legal fees, medical quotes and unresolved amounts are excluded, not zero. Brakes are safety-critical; medical needs require clinical review, not discretionary deferral.'))
    story.append(p('Additional client travel is '+money(proposal['business']['travelMonthlyMinMinor'])+' to '+money(proposal['business']['travelMonthlyMaxMinor'])+' per month only when paid project scope requires it. It is separate from household petrol and excluded from core needs. Additional internet must not duplicate household connectivity. Hardware, office, staff and corporate services require separate scope and agreement.'))
    story.append(p('Itemised recurring source detail: '+money(funding['sourceRecurringMinor'])+' monthly. Difference from the essentials estimate: '+money(funding['essentialsDifferenceMinor'])+'. Reconciliation is outstanding; the difference is not an additional funding item.','small'))
else:
    summary=[['Personal expenditure',finance['personal']['baseline']],['Business operating costs',finance['business']['baseline']],['Combined operating baseline',all_totals['baseline']],['Optional hardware',all_totals['optional']],['Known source total',all_totals['known']]]
    story.append(table(['Scope','ZAR primary','GBP secondary'],[[label,money(value),money(value,'GBP')] for label,value in summary],[245,125,129]))
story.append(p('Illustrative exchange rate: 1 GBP = '+str(finance['rate'])+' ZAR. Not a live rate. GBP subtotals convert ZAR once; displayed rows may round differently. '+str(all_totals['unresolved'])+' unknown source amounts remain excluded. No revenue or disputed recovery is assumed.'))
revision=finance.get('revision')
if revision:story.append(p('Prior source-budget revision retained: '+revision['owner']+' / '+revision['recordedOn']+'. Workbook: '+os.path.basename(revision['workbook'])+' / SHA-256 '+revision['workbookSha256']+'. Original financial history is preserved.','small'))
story.append(p('Sustainable / Salary-Style comparison','h2'))
story.append(p('Owner input required; no sustainable salary or allowance has been approved.' if scenario['sustainableMinor'] is None else 'Reviewer-entered alternative: '+money(scenario['sustainableMinor'])+' / '+money(scenario['sustainableMinor'],'GBP')+'. Replaces personal monthly minimum; it is not an addition or approved salary.'))
story.append(p('A personal loan remains acceptable for discussion. Funding structure, interest, repayment and commercial arrangements are negotiable and require formal documentation. Independent JB³ income and properly agreed Beobacht commercial arrangements are distinct routes; Bruce’s personal bridge loan does not automatically become a Beobacht corporate liability.'))
for name in ['Personal','Business']:
    story.append(p(name+' supporting source schedule - draft','h2'))
    if funding and name=='Personal':story.append(p('Recurring items below are inside the household allowance. This supporting subtotal is not an additional funding requirement.'))
    rows=[]
    for row in finance['rows']:
        if row['schedule']==name:rows.append([row['label']+(' / optional' if row['optional'] else '')+(' / '+row['funding']['status']+' / '+row['funding']['urgency'] if row.get('funding') else ''),(row['funding']['status'] if row.get('funding') else 'Awaiting reconciliation') if row['amountMinor'] is None else money(row['amountMinor']),'Excluded / unknown' if row['amountMinor'] is None else money(row['amountMinor'],'GBP')])
    story.append(table(['Expenditure','Known five-month ZAR','GBP'],rows,[245,125,129]))
story.append(PageBreak());title('Outstanding confirmations & provenance')
for row in finance['rows']:
    story.append(KeepTogether([p(row['label']+' / '+row['approval'],'h2'),p(row['note'],'small'),p('Source: '+row['originalFilename']+' / '+row['source']+' / UUID '+row['id'],'small')]))
story.append(p('Supporting document references: draft evidence','h2'))
for record in data['documents']:
    heading=Paragraph('<a name="doc-'+text(record['id'])+'"/>'+text(record['title']),styles['h2'])
    story.append(KeepTogether([heading,p(record['originalFilename']+' / '+record['citation']+'\n'+record['sourceReference']+'\n'+record['approval']+' / '+record['verification'],'small')]))
doc.multiBuild(story)
sys.stdout.buffer.write(output.getvalue())
