"""docs/photo-texts/notes.md (owner's photo texts) → info-note JSON blocks (src/lib/formatInfo.ts types) for the law
"विस्तृत विश्लेषण" card. Drops the photo-number headers and Claude's own "(…)" notes; text otherwise as is.
Usage: python3 -I scripts/md_to_info_blocks.py <notes.md> <out.json>"""
import json, re, sys

def clean(L):
    L = re.sub(r'\s*\[\?\]', '', L)
    L = re.sub(r' \(फोटो में "…डिजिटल".*?\)', '', L)
    return L.replace(' `0/17`', '').rstrip()

def parse(lines):
    out = []; i = 0
    def lst(kind, item, **kw):
        if out and out[-1]['t'] == kind and not out[-1].get('_closed'):
            out[-1]['i'].append(item)
        else:
            out.append({'t': kind, 'i': [item], **kw})
    while i < len(lines):
        L = clean(lines[i])
        if (not L.strip() or L == '---' or L.startswith('# फोटो से') or re.match(r'^## \d+  \(', L)
                or L.startswith('(') or L.startswith('`[ रीसेट')):
            if out and out[-1]['t'] in ('ul', 'ol', 'check') and not L.strip():
                out[-1]['_closed'] = True
            i += 1; continue
        if L.startswith('>'):
            q = []
            while i < len(lines) and lines[i].startswith('>'):
                q.append(lines[i][1:].lstrip(' ') if lines[i].startswith('> ') else lines[i][1:]); i += 1
            out.append({'t': 'card', 'blocks': parse(q)}); continue
        if L.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            out.append({'t': 'table', 'head': rows[0], 'rows': rows[2:]}); continue
        if L.startswith('**[चित्र 1'):
            out.append({'t': 'img', 'key': 'bnss194-flow', 'caption': 'चित्र 1 (बाएँ) — Flow chart · चित्र 2 (दाएँ) — POLICE INQUEST'}); i += 1; continue
        if L.startswith('**[चित्र 2'):
            out.append({'t': 'h2', 'x': 'चित्र 2 — POLICE INQUEST'}); i += 1; continue
        if L.startswith('**Inquest Duty Checklist**'):
            out.append({'t': 'check', 'i': [], 'interactive': True, 'title': 'Inquest Duty Checklist'}); i += 1; continue
        if L.startswith('### '): out.append({'t': 'h2', 'x': L[4:]})
        elif L.startswith('## '): out.append({'t': 'h', 'x': L[3:]})
        elif L.startswith('# '): out.append({'t': 'head', 'label': '', 'title': L[2:], 'lines': []})
        elif L.startswith('- ☐'):
            if out and out[-1]['t'] == 'check': out[-1]['i'].append(L[3:].strip())
            else: lst('check', L[3:].strip())
        elif L.startswith('- '): lst('ul', L[2:])
        elif re.match(r'^\d+\.\s', L): lst('ol', re.sub(r'^\d+\.\s+', '', L))
        elif L.startswith('`') and L.endswith('`'):
            if out and out[-1]['t'] == 'head' and not out[-1]['lines']: out[-1]['lines'].append(L.strip('`'))
            else: out.append({'t': 'tag', 'x': L.strip('`')})
        else: out.append({'t': 'p', 'x': L.replace('`', '')})
        i += 1
    for b in out: b.pop('_closed', None)
    return out

src, dst = sys.argv[1], sys.argv[2]
blocks = parse(open(src, encoding='utf8').read().split('\n'))
json.dump({'v': 1, 'source': 'owner photos BNSS 194/195 notes (docs/photo-texts/notes.md)', 'keep': ['mist', 'ex'], 'blocks': blocks},
          open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(b['t'] for b in blocks))
