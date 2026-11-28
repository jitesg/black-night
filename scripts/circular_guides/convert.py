"""परिपत्र गाइड converter (owner: 70/2013 layout = base for every DGP परिपत्र).

Reads a परिपत्र's own app text (assets/seed/circulars_seed*.json description) and writes
assets/circular-guides/<id>.json in the base structure — nothing new is written, only the परिपत्र's
own parts are moved into sections:
  दिनांक / जारीकर्ता / प्रेषित / विषय / संदर्भ / संबंधित पद → 1 विवरण ; सार → सार box ;
  मुख्य निर्देश → निर्देश points ; पृष्ठभूमि → पृष्ठभूमि points ; सेल्फ-चेक ☐ … → चेकलिस्ट.
  Any other heading with bullet / "1)" lines under it (2012: उद्देश्य, समय-सीमाएँ, लागू शर्तें, टैब 1 …) stays its own part: its points
  go into निर्देश in the text's order, the first one carrying `h` = the heading (shown as a sub-heading). हस्ताक्षरकर्ता / प्रकार
  lines → विवरण rows (प्रतिलिपि left out, as in batches 1–4).
short title, ⚖️ line, laws (old IPC/CrPC sections) and related परिपत्र come from OVERRIDES (checked by hand per batch).

Run: python3 -I scripts/circular_guides/convert.py <id> [<id> …]   (70/2013 is hand-written — never converted)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'circular_guides'))
from overrides import OVERRIDES  # noqa: E402

def load_all():
    out = {}
    d = os.path.join(ROOT, 'assets', 'seed')
    for f in sorted(os.listdir(d)):
        if not f.startswith('circulars_seed'):
            continue
        data = json.load(open(os.path.join(d, f), encoding='utf-8'))
        arr = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
        for e in arr:
            out[e['id']] = e
    return out

HEADS = ['सार', 'पृष्ठभूमि', 'मुख्य निर्देश', 'संदर्भ']

def section(text, head):
    m = re.search(r'^' + re.escape(head) + r'[:：]?\s*\n(.*?)(?=\n\s*\n|\n(?:' + '|'.join(HEADS) + r'|संबंधित पद)[:：]?|\Z)', text, re.M | re.S)
    return m.group(1).strip() if m else ''

def bullets(block):
    items, cur = [], ''
    for line in block.split('\n'):
        line = line.strip()
        if not line:
            continue
        if line.startswith('•'):
            if cur: items.append(cur)
            cur = line.lstrip('•').strip()
        else:
            cur = (cur + ' ' + line).strip()
    if cur: items.append(cur)
    return items

ITEM = re.compile(r'^\d+\)\s*')

def blocks(text):
    """[(heading, [items])] — a heading line followed by "•" / "1)" lines (a line without a mark continues the item above)."""
    lines = text.split('\n'); out = []; i = 0
    while i < len(lines):
        head = lines[i].strip()
        if head and not head.startswith('•') and not head.startswith('☐') and not ITEM.match(head):
            items, cur, j = [], None, i + 1
            while j < len(lines):
                x = lines[j].strip()
                if not x:
                    break
                if x.startswith('•') or ITEM.match(x):
                    if cur: items.append(cur)
                    cur = ITEM.sub('', x.lstrip('•').strip()).strip()
                elif cur is not None:
                    cur = (cur + ' ' + x).strip()
                else:
                    break
                j += 1
            if cur: items.append(cur)
            if items:
                out.append((re.sub(r'[:：]\s*$', '', head).strip(), items)); i = j; continue
        i += 1
    return out

def field(text, name):
    m = re.search(r'^' + re.escape(name) + r'[:：]\s*(.+)$', text, re.M)
    return m.group(1).strip() if m else ''

def convert(e, ov):
    t = e['description'].split('[[SADHARAN]]')[0] + '\n' + e['description'].split('[[/SADHARAN]]')[-1].split('━━━━')[0]
    first = e['description'].split('\n', 1)[0]
    number = first.split(' — ')[0].strip()
    date = field(t, 'दिनांक')
    details = [{'k': 'परिपत्र संख्या एवं दिनांक', 'v': f'{number}, दिनांक {date}' if date else number, 'accent': True}]
    for k, name in (('जारीकर्ता', 'जारीकर्ता'), ('हस्ताक्षरकर्ता', 'हस्ताक्षरकर्ता'), ('प्रकार', 'प्रकार'), ('प्रेषिती', 'प्रेषित')):
        v = field(t, name)
        if v: details.append({'k': k, 'v': v})
    bl = blocks(t)
    ref = [x for h, items in bl if h.startswith('संदर्भ') for x in items]
    if ref: details.append({'k': 'संदर्भ', 'v': '; '.join(ref)})
    sub = field(t, 'विषय')
    if sub: details.append({'k': 'विषय', 'v': sub})
    pad = field(t, 'संबंधित पद')
    if pad: details.append({'k': 'संबंधित पद', 'v': pad})
    g = {'v': 1, 'short': ov['short'], 'kicker': ov.get('kicker', '⚖️ उ0प्र0 पुलिस मुख्यालय'), 'details': details}
    if ov.get('laws'): g['laws'] = ov['laws']
    sar = section(t, 'सार')
    if sar:
        g.update({'problem': ' '.join(l.strip() for l in sar.split('\n') if l.strip()), 'problemTitle': 'सार', 'problemNav': 'सार'})
    pts, title = [], 'मुख्य निर्देश'
    for h, items in bl:
        if h.startswith('संदर्भ') or h.startswith('पृष्ठभूमि') or h.startswith('सेल्फ-चेक') or h.startswith('संबंधित पद'):
            continue
        if h.startswith('मुख्य निर्देश'):
            title = h
            pts += [{'b': x} for x in items]
        else:
            pts += [({'h': h, 'b': x} if k == 0 else {'b': x}) for k, x in enumerate(items)]
    if pts:
        g['directions'] = {'title': title, 'points': pts}
    if ov.get('related'): g['related'] = ov['related']
    bg = [x for h, items in bl if h.startswith('पृष्ठभूमि') for x in items]
    if bg: g['case'] = {'title': 'पृष्ठभूमि', 'nav': 'पृष्ठभूमि', 'points': bg}
    m = re.search(r'सेल्फ-चेक[^\n]*\n(.+?)(?:\n\s*\n|\Z)', e['description'], re.S)
    if m:
        block = m.group(1)
        # "☐ a  ☐ b" on one line, or one "• a" bullet per line
        items = [x.strip() for x in block.split('☐') if x.strip()] if '☐' in block else bullets(block)
        if items:
            g['checklist'] = {'title': 'सेल्फ-चेक', 'intro': 'परिपत्र का पालन करते समय tick करें:', 'items': [{'t': x} for x in items],
                              'doneText': 'सब बिंदु पूरे।', 'pendingText': '{n} बिंदु बाकी।'}
    g['foot'] = f'स्रोत: पुलिस महानिदेशक मुख्यालय, उ0प्र0 ({number}{", " + date if date else ""}) · ⚠ सहायक सारांश — कार्यवाही से पहले मूल हस्ताक्षरित परिपत्र से मिलान करें।'
    return g

def main(ids):
    allc = load_all()
    for i in ids:
        if i == 'sys-circ-dg-70-2013':
            print('skip 70/2013 (hand-written)'); continue
        g = convert(allc[i], OVERRIDES[i])
        path = os.path.join(ROOT, 'assets', 'circular-guides', f'{i}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(g, f, ensure_ascii=False, indent=2); f.write('\n')
        print('wrote', path, {k: (len(v) if isinstance(v, list) else 1) for k, v in g.items() if k in ('details', 'laws', 'related')},
              'points', len(g.get('directions', {}).get('points', [])), 'bg', len(g.get('case', {}).get('points', [])),
              'check', len(g.get('checklist', {}).get('items', [])))

if __name__ == '__main__':
    main(sys.argv[1:])
