"""Private QA only: receives approved data on stdin; no content in stdout."""
import sys,json,re,unicodedata,os
from pypdf import PdfReader
from decimal import Decimal,ROUND_HALF_UP
import pymupdf as fitz
data=json.load(sys.stdin);filename=sys.argv[1]
reader=PdfReader(filename);doc=fitz.open(filename)
def normal(value):
 value=unicodedata.normalize('NFKC',value)
 value=re.sub(r'CONFIDENTIAL\s*/\s*BRUCE BLACKBURN\s*\d+','',value)
 return re.sub(r'[\s*#`\u00ad]','',value)
texts=[page.extract_text() or '' for page in reader.pages];whole=normal('\n'.join(texts))
assert len(texts)>14,'Master should contain the full presentation'
checked=0
for section in data['sections']:
 for paragraph in re.split(r'\n\s*\n',section['narrative']['payload']['body']):
  if re.match(r'^---+$',paragraph.strip()):continue
  assert normal(paragraph) in whole,'An approved narrative paragraph was omitted or changed'
  checked+=1
outlines=[]
def walk(items):
 for item in items:
  if isinstance(item,list):walk(item)
  else:outlines.append(item)
walk(reader.outline)
assert len(outlines)==(15 if data.get('assets') else 14),'Missing section boundaries or table-of-contents entries'
toc=normal(texts[1])
for destination in outlines:
 index=reader.get_destination_page_number(destination)
 assert normal(destination.title) in normal(texts[index]),'Section bookmark/page mismatch'
 assert normal(destination.title) in toc,'Table of contents title missing'
printed=[int(word[4]) for word in doc[1].get_text('words') if word[0]>doc[1].rect.width-105 and word[1]<doc[1].rect.height-60 and word[4].isdigit()]
assert printed==[reader.get_destination_page_number(destination)+1 for destination in outlines],'Table of contents page number mismatch'
images=sum(len(page.get_images()) for page in doc)
assert images>=12,'Draft photo interlude incomplete'
all_rows=data['finances']['personal']+data['finances']['business']
total=sum(row['payload']['amountMinor'] or 0 for row in all_rows)
personal=sum(row['payload']['amountMinor'] or 0 for row in data['finances']['personal'])
business=sum(row['payload']['amountMinor'] or 0 for row in data['finances']['business'] if not json.loads(row['payload']['reconciliationNote'])['optionalHardware'])
optional=total-personal-business
proposal=data['finances'].get('funding')
if proposal:
 treatments={row['recordId']:row['treatment'] for row in proposal['rows']}
 household=proposal['household']['minimumMonthlyMinor']*len(proposal['household']['periods'])
 business=sum(row['payload']['amountMinor'] or 0 for row in data['finances']['business'] if treatments[row['id']]=='essential-business')
 once=sum(round(float(json.loads(row['payload']['reconciliationNote'])['oneOffZar'] or 0)*100) for row in data['finances']['personal'] if treatments[row['id']]=='additional-one-off')
 amounts=[household,business,household+business,once,household+business+once,optional]
 assert 'replaces' in ''.join(texts).lower(),'Missing no-double-counting disclosure'
 assert 'restricted legal entries' in ''.join(texts).lower(),'Missing restricted derivative disclosure'
 for entry in data.get('assets',{}).get('entries',[]):
  if entry['classification']=='LEGAL_RESTRICTED':
   for note in entry['verificationNotes']:assert normal(note) not in whole,'Restricted asset metadata leaked into recipient PDF'
else:amounts=[personal,business,personal+business,optional,total]
for amount in amounts:
 zar=Decimal(amount)/100
 assert format(zar,',.2f') in ''.join(texts),'PDF ZAR summary discrepancy'
 if 'reviewFx' in data:
  gbp=(zar/Decimal(str(data['reviewFx']))).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
  assert format(gbp,',.2f') in ''.join(texts),'PDF selected-rate GBP summary discrepancy'
assert 'DRAFT' in ''.join(texts),'Draft disclosure missing'
for page in doc:
 for block in page.get_text('blocks'):
  if len(block)>4 and str(block[4]).strip():assert block[0]>=25 and block[2]<=page.rect.width-20 and block[1]>=10 and block[3]<=page.rect.height-10,'Text outside safe page bounds'
folder=os.path.dirname(filename)
selected={0,2}
for destination in outlines:
 if 'draft evidence' in destination.title or 'Financial summary' in destination.title or 'Assets & Potential' in destination.title:selected.add(reader.get_destination_page_number(destination))
for index in sorted(selected):doc[index].get_pixmap(matrix=fitz.Matrix(1.4,1.4)).save(os.path.join(folder,'pdf-page-'+str(index+1)+'.png'))
print(json.dumps({'pdfPages':len(texts),'narrativeParagraphs':checked,'outlineEntries':len(outlines),'imageInstances':images,'paginationAndTextPassed':True,'renderedPages':[index+1 for index in sorted(selected)]}))
