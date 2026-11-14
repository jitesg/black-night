import docx,json,re,sys
from docx.table import Table
from docx.text.paragraph import Paragraph
src,out=sys.argv[1],sys.argv[2]
d=docx.Document(src)
def runs(p):
    s=''
    for r in p.runs:
        t=r.text
        if r.bold and t.strip(): s+='**'+t+'**'
        else: s+=t
    return s.replace('****','').strip()
blocks=[]; head=[]; started=False
def push_list(kind,item):
    if blocks and blocks[-1]['t']==kind: blocks[-1]['i'].append(item)
    else: blocks.append({'t':kind,'i':[item]})
for el in d.element.body.iterchildren():
    tag=el.tag.split('}')[1]
    if tag=='p':
        p=Paragraph(el,d); t=p.text.strip()
        if not t: continue
        st=p.style.name
        if not started and st=='Normal': head.append(t); continue
        if not started:
            started=True
            blocks.insert(0,{'t':'head','label':head[0] if head else '','title':head[1] if len(head)>1 else '','lines':head[2:]})
        if st=='Heading 1': blocks.append({'t':'h','x':t})
        elif st.startswith('Heading'): blocks.append({'t':'h2','x':t})
        elif st=='List Bullet': push_list('ul',runs(p))
        elif st=='List Number': push_list('ol',runs(p))
        elif t.startswith('☐'): push_list('check',re.sub(r'^☐\s*','',t))
        else: blocks.append({'t':'p','x':runs(p)})
    elif tag=='tbl':
        tb=Table(el,d); x=el.xml
        rows=[[c.text.strip() for c in r.cells] for r in tb.rows]
        # merged cells repeat — drop exact duplicate neighbours
        rows=[[c for i,c in enumerate(r) if i==0 or c!=r[i-1]] for r in rows]
        if len(rows)==1 and len(rows[0])==1:
            txt=rows[0][0]; m=re.match(r'^([^:：]{1,40})[:：]\s*(.*)$',txt,re.S)
            fills=re.findall(r'w:fill="([0-9A-Fa-f]{6})"',x)
            warn=any(f.upper() in('FFF2CC','FFF4CE','FDE9D9','FCE4D6','FFE699','FFF0F0','FBE4D5','FFEB9C') for f in fills)
            blocks.append({'t':'box','tone':'warn' if warn else 'info','label':m.group(1).strip() if m else '','x':(m.group(2) if m else txt).strip()})
        else:
            blocks.append({'t':'table','head':rows[0],'rows':rows[1:]})
json.dump({'v':1,'source':src.split('/')[-1],'blocks':blocks},open(out,'w'),ensure_ascii=False,indent=1)
from collections import Counter
print(Counter(b['t'] for b in blocks)); print(json.dumps(blocks[0],ensure_ascii=False))
for b in blocks:
    if b['t'] in('box','table'): print(b['t'],b.get('tone',''),(b.get('label') or '|'.join(b.get('head',[])))[:80], len(b.get('rows',[])))
