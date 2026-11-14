import re,sys
from docx import Document
from docx.shared import Pt, RGBColor, Mm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
src,img,out=sys.argv[1],sys.argv[2],sys.argv[3]
lines=open(src,encoding='utf8').read().split('\n')
NAVY=RGBColor(0x1F,0x4E,0x79); FONT='Mangal'
doc=Document()
sec=doc.sections[0]; sec.page_height=Mm(297); sec.page_width=Mm(210)
for m in ('left_margin','right_margin','top_margin','bottom_margin'): setattr(sec,m,Mm(18))
def setfont(run,size=12,bold=None,color=None,italic=None):
    run.font.name=FONT; run.font.size=Pt(size)
    rpr=run._element.get_or_add_rPr(); rf=rpr.find(qn('w:rFonts'))
    if rf is None: rf=OxmlElement('w:rFonts'); rpr.append(rf)
    for a in ('w:ascii','w:hAnsi','w:cs','w:eastAsia'): rf.set(qn(a),FONT)
    szcs=OxmlElement('w:szCs'); szcs.set(qn('w:val'),str(int(size*2))); rpr.append(szcs)
    if bold: run.bold=True; b=OxmlElement('w:bCs'); rpr.append(b)
    if italic: run.italic=True
    if color is not None: run.font.color.rgb=color
def rich(p,text,size=12,color=None,bold_all=False):
    text=text.replace('`','')
    for i,part in enumerate(re.split(r'\*\*(.+?)\*\*',text)):
        if not part: continue
        r=p.add_run(part); setfont(r,size,bold=bold_all or i%2==1,color=color)
def para(text='',size=12,color=None,bold=False,align=None,space=4,indent=None,shade=None):
    p=doc.add_paragraph(); pf=p.paragraph_format; pf.space_after=Pt(space); pf.space_before=Pt(0); pf.line_spacing=1.25
    if align=='c': p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    if indent: pf.left_indent=Mm(indent)
    if shade:
        ppr=p._p.get_or_add_pPr(); sh=OxmlElement('w:shd'); sh.set(qn('w:val'),'clear'); sh.set(qn('w:fill'),shade); ppr.append(sh)
    if text: rich(p,text,size,color,bold)
    return p
def heading(text,level):
    size={1:18,2:15,3:13}[level]
    p=para(text,size,NAVY,True,space=6)
    p.paragraph_format.space_before=Pt(10 if level<3 else 6); p.paragraph_format.keep_with_next=True
    if level==2:
        ppr=p._p.get_or_add_pPr(); bd=OxmlElement('w:pBdr'); b=OxmlElement('w:bottom')
        for k,v in (('w:val','single'),('w:sz','6'),('w:space','1'),('w:color','BFD3E6')): b.set(qn(k),v)
        bd.append(b); ppr.append(bd)
def table(rows):
    hdr=[c.strip() for c in rows[0].strip('|').split('|')]
    body=[[c.strip() for c in r.strip('|').split('|')] for r in rows[2:]]
    t=doc.add_table(rows=1+len(body),cols=len(hdr)); t.style='Table Grid'
    for j,h in enumerate(hdr):
        c=t.rows[0].cells[j]; c.text=''; rich(c.paragraphs[0],h,11,RGBColor(255,255,255),True)
        tcpr=c._tc.get_or_add_tcPr(); sh=OxmlElement('w:shd'); sh.set(qn('w:val'),'clear'); sh.set(qn('w:fill'),'1F4E79'); tcpr.append(sh)
    for i,r in enumerate(body):
        for j in range(len(hdr)):
            c=t.rows[i+1].cells[j]; c.text=''; rich(c.paragraphs[0],r[j] if j<len(r) else '',11,bold_all=(j==0))
    para('',space=2)
i=0; num=0
while i<len(lines):
    L=lines[i].rstrip()
    if L.startswith('# फोटो से') or re.match(r'^## \d+  \(',L) or L.startswith('(') or L=='---' or L.startswith('`[ रीसेट'):
        i+=1; continue
    L=re.sub(r'\s*\[\?\]','',L)
    L=re.sub(r' \(फोटो में "…डिजिटल".*?\)','',L)
    L=L.replace(' `0/17`','')
    if not L.strip(): i+=1; num=0; continue
    if L.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'): rows.append(lines[i]); i+=1
        table(rows); continue
    if L.startswith('**[चित्र 1'):
        doc.add_picture(img,width=Inches(5.8)); doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
        para('चित्र 1 — Flow chart (फोटो से)',11,NAVY,True,'c'); i+=1; continue
    if L.startswith('**[चित्र 2'):
        para('चित्र 2 — POLICE INQUEST (फोटो से)',11,NAVY,True,'c'); i+=1; continue
    if L.startswith('### '): heading(L[4:],3); i+=1; continue
    if L.startswith('## '): heading(L[3:],2); i+=1; continue
    if L.startswith('# '): heading(L[2:],1); doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER; i+=1; continue
    q=L.startswith('>')
    t=L.lstrip('> ').rstrip() if q else L
    if q and not t: i+=1; continue
    ind=6 if q else 0; shade='EAF2F8' if q else None
    m=re.match(r'^(\d+)\.\s+(.*)',t)
    if t.startswith('- '):
        item=t[2:]
        mark='☐ ' if item.startswith('☐') else '• '
        if item.startswith('☐'): item=item[1:].strip()
        p=para('',indent=ind+6,shade=shade); p.paragraph_format.first_line_indent=Mm(-5)
        r=p.add_run(mark); setfont(r,12,True,NAVY); rich(p,item)
    elif m:
        p=para('',indent=ind+7,shade=shade); p.paragraph_format.first_line_indent=Mm(-6)
        r=p.add_run(m.group(1)+'. '); setfont(r,12,True,NAVY); rich(p,m.group(2))
    elif t.startswith('`') and t.endswith('`'):
        para(t,10.5,RGBColor(0x15,0x80,0x3D),True)
    else:
        para(t,indent=ind or None,shade=shade)
    i+=1
doc.save(out); print('ok')
