#!/usr/bin/env python3
"""Render the shared semantic print guide/passport; never re-layout book pages."""
import argparse, json, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.pdfgen.canvas import Canvas
from pypdf import PdfReader

parser=argparse.ArgumentParser()
parser.add_argument('--model',required=True)
parser.add_argument('--output',required=True)
parser.add_argument('--kind',choices=['instructions','passport'],required=True)
a=parser.parse_args()
g=json.loads(Path(a.model).read_text())
root=Path.cwd()
font=root/'docs/design/travel-memory-books-v1/assets/fonts/NotoSans-Regular.ttf'
pdfmetrics.registerFont(TTFont('Guide',str(font)))
normal=ParagraphStyle('Body',fontName='Guide',fontSize=9.5,leading=14,spaceAfter=7,splitLongWords=True)
heading=ParagraphStyle('Heading',parent=normal,fontSize=13,leading=18,spaceBefore=12,spaceAfter=8,keepWithNext=True)
small=ParagraphStyle('Small',parent=normal,fontSize=7.2,leading=10)
story=[]
def p(text,style=normal): return Paragraph(escape(str(text)),style)
def add(text,style=normal): story.append(p(text,style))
add(g['title'] if a.kind=='instructions' else 'Паспорт пробной печати',heading)
add(g['bookTitle']+' / '+g['bookProfileId'])
add('Редакция: '+g['revision'],small)
add(g['summary']);add(g['assembly']);add(g['sewnNote'])
if a.kind=='instructions':
    for section in g['sections']:
        add(section['title'],heading)
        for text in section['paragraphs']: add(text)
    add('Файлы этой редакции',heading)
    for f in g['entries']:
        add(f['name'],small)
        add(f"{f['pageCount']} стр.; {f['bytes']} байт",small)
else:
    ps=g['passport']
    add('Параметры файла',heading)
    for text in [f"Обрезной формат: {ps['widthMm']} × {ps['heightMm']} мм. Вылеты: {ps['bleedMm']} мм с каждой стороны.",f"Безопасное поле: {ps['safeMm']} мм; полоса крепления: {ps['bindingMm']} мм. Базовый переплёт: {ps['binding']}.",f"Цвет: {ps['colorSpace']}; ICC: {ps['iccStatus']}; PDF/X: {ps['pdfXStatus']}.",f"Минимальное измеренное разрешение иллюстраций: {ps['minIllustrationPpi']} ppi. "+('Порог 300 ppi не достигнут.' if ps['minIllustrationPpi'] < 300 else 'Измеренное разрешение выше порога 300 ppi; остальные условия печати требуют подтверждения.'),'Приём точных файлов типографией, конструкция переплёта с вклейками и бумажный пробник не подтверждены. Этот паспорт не является разрешением чистовой печати.']:
        add(text)
    for f in ps['files']:
        add(f['name'],heading)
        add(f"{f['pageCount']} страниц; {f['bytes']} байт. SHA-256:")
        add(f['sha256'],small)
    add('Попросите типографию проверить точные файлы, формат, вылеты, поля, цвет, разрешение, бумагу, тираж, переплёт, доставку и стоимость до заказа.')
add('Польская сопроводительная записка',heading);add(g['polishNote'])
add('Источники и дата проверки',heading)
add('Проверено '+g['checkedAt']+'. Параметры раскладки получены из файлов этой редакции. Допуски принтера проверяются по руководству вашей модели.',small)
for source in g['sources']:
    add(source['title'],small); add(source['url'],small)
class DeterministicCanvas(Canvas):
    def __init__(self,*args,**kwargs): kwargs['invariant']=1;kwargs['initialFontName']='Guide';super().__init__(*args,**kwargs)
def footer(c,doc):
    c.saveState();c.setFont('Guide',8);c.setFillColor(colors.black)
    c.drawString(16*mm,12*mm,'MeTravel / RU / '+str(doc.page))
    if doc.page==1:
        c.line(140*mm,12*mm,190*mm,12*mm)
        c.drawString(140*mm,16*mm,'50 мм · 100%')
    c.restoreState()
Path(a.output).parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(a.output,pagesize=(210*mm,297*mm),rightMargin=16*mm,leftMargin=16*mm,topMargin=16*mm,bottomMargin=25*mm,title=g['title'],author='MeTravel').build(story,onFirstPage=footer,onLaterPages=footer,canvasmaker=DeterministicCanvas)
r=PdfReader(a.output)
assert all(abs(float(page.mediabox.width)/mm-210)<.1 and abs(float(page.mediabox.height)/mm-297)<.1 for page in r.pages)
text='\n'.join(page.extract_text() for page in r.pages)
compact=''.join(text.split())
assert g['revision'] in compact and '100%' in compact
for f in g['passport']['files']: assert f['name'] in compact
for section in g['sections'] if a.kind=='instructions' else []: assert ''.join(section['title'].split()) in compact
fonts=subprocess.run(['pdffonts',a.output],capture_output=True,text=True,check=True).stdout.splitlines()[2:]
assert fonts, 'Embedded Cyrillic font required'
for line in fonts:
    columns=line.split()
    assert columns[-5]=='yes' and columns[-3]=='yes', 'Font must be embedded with Unicode map'
bbox=subprocess.run(['pdftotext','-bbox',a.output,'-'],capture_output=True,text=True,check=True).stdout
words=[element for element in ET.fromstring(bbox).iter() if element.tag.endswith('}word')]
assert words and all(float(w.attrib['xMin'])>=14*mm and float(w.attrib['xMax'])<=196*mm and float(w.attrib['yMin'])>=12*mm and float(w.attrib['yMax'])<=287*mm for w in words), 'Text exceeds safe page bounds'
print(json.dumps({'pageCount':len(r.pages),'outputPageMm':{'width':210,'height':297}}))
