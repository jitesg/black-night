"""Adds {"hint": …} to predefined format fields (owner: "ⓘ भरने का तरीका जानें" on every field).
Usage: python3 scripts/hints/apply_hints.py <batch>   (batch module in scripts/hints/, e.g. gd)
Only fields WITHOUT a hint get one; each changed format gets seed_version + 1."""
import importlib, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
batch = importlib.import_module(sys.argv[1])
p = 'assets/seed/formats_seed.json'
raw = open(p, encoding='utf-8').read(); d = json.loads(raw)
L = d if isinstance(d, list) else d.get('formats')
done = missing = 0
for f in L:
    if not batch.wants(f):
        continue
    changed = False
    for k in f['keys']:
        o = k.get('dropdown_options')
        try: v = json.loads(o) if o else None
        except Exception: v = None
        slot = 'tip' if k.get('field_type') == 'sentence' else 'hint'  # sentence config uses "hint" itself
        if isinstance(v, dict) and v.get(slot):
            continue
        h = batch.hint(f, k)
        if not h:
            missing += 1; print('NO HINT', f['id'], k['key_name'], '|', k['label']); continue
        obj = {'options': v} if isinstance(v, list) else (v if isinstance(v, dict) else {})
        if o and v is None:  # comma list → keep as options
            obj = {'options': [x.strip() for x in o.split(',') if x.strip()]}
        obj[slot] = h
        k['dropdown_options'] = json.dumps(obj, ensure_ascii=False)
        changed = True; done += 1
    if changed:
        f['seed_version'] = f.get('seed_version', 0) + 1
out = json.dumps(d, ensure_ascii=False, indent=2)
if raw.endswith('\n'): out += '\n'
open(p, 'w', encoding='utf-8').write(out)
print('hints added', done, 'missing', missing)
