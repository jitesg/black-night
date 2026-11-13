/**
 * mergedKnowledge.ts — the reading text ("जानकारी") of the merged cards (owner): मेडिकल, साक्ष्य व FSL, अभियुक्त, हथियार,
 * CCTV, गवाहों के बयान, मकसद व रंजिश, डिजिटल व लेन-देन, समापन — and the extra cards folded into पंचनामा व पोस्टमार्टम.
 * Nothing is dropped: every folded playbook card's text is shown under its part, built live from the playbook data.
 */
import type { KnowledgeSection } from '@/lib/defaultKaryvahiKnowledge';
import { CRIME_FILES, SHARED_FILES } from '@/lib/db/playbooks/registry';
import { parseStepLines } from '@/lib/db/playbooks/parse';
import { MURDER_STEPS } from '@/lib/db/playbooks/murder';
import { ATTEMPT_MURDER_STEPS } from '@/lib/db/playbooks/attemptMurder';
import { PLAYBOOK_TEXTS } from '@/lib/db/playbooks/playbookTexts';
import { stepBody, type StepText } from '@/lib/sceneKnowledge';
import type { ChecklistDef } from '@/lib/karyvahiSubSteps';

type Named = StepText & { task_name?: string };

let byCode: Map<string, Named> | null = null;

/** Every playbook card's texts by step code (built once). */
function texts(): Map<string, Named> {
  if (byCode) return byCode;
  const m = new Map<string, Named>();
  for (const f of [...CRIME_FILES, ...SHARED_FILES]) {
    for (const st of parseStepLines(f.raw)) if (!m.has(st.step_code)) m.set(st.step_code, st as Named);
  }
  for (const r of [...MURDER_STEPS, ...ATTEMPT_MURDER_STEPS] as Array<Named & { step_code: string }>) {
    if (!m.has(r.step_code)) m.set(r.step_code, { ...r, ...(PLAYBOOK_TEXTS[r.step_code] ?? {}) });
  }
  byCode = m;
  return m;
}

function codesOf(raw: string | null | undefined): string[] {
  return String(raw ?? '').split(',').map((c) => c.trim()).filter(Boolean);
}

const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

/** Merged card: overview + one section per part with the texts of the cards folded into it. */
export function mergedKnowledgeSections(def: ChecklistDef, mergedCodesRaw: string | null | undefined): KnowledgeSection[] {
  const merged = codesOf(mergedCodesRaw);
  const t = texts();
  const overview: KnowledgeSection = {
    title: 'इस कार्यवाही में क्या-क्या है',
    body: [
      `इस एक कार्ड में ${def.steps.length} हिस्सों की चेकलिस्ट है:`,
      ...def.steps.map((s, i) => `${i + 1}. ${s.label} (${s.optional ? 'वैकल्पिक' : 'ज़रूरी'})`),
      '',
      'केस डायरी में यह कार्यवाही चुनें, फिर "कौन सा हिस्सा लिख रहे हैं?" में हिस्सा चुनें — पर्चे में उसी हिस्से का नाम छपेगा और save होते ही उस पर पर्चा नंबर के साथ ✓ लग जाएगा। कार्ड की चेकलिस्ट पर हाथ से भी ✓ लगा सकते हैं।',
      'ज़रूरी हिस्से पूरे होने पर कार्यवाही पूरी मानी जाती है।',
    ].join('\n'),
  };
  const parts = def.steps.map((s, i) => {
    const codes = (s.codes ?? []).filter((c) => merged.length === 0 || merged.includes(c));
    const bodies = codes.map((c) => {
      const st = t.get(c);
      const b = stepBody(st);
      if (!b) return '';
      return codes.length > 1 ? `— ${st?.task_name ?? c} —\n${b}` : b;
    }).filter(Boolean);
    return { title: `${NUM[i] ?? `${i + 1}.`} ${s.label}`, body: bodies.join('\n\n') || 'इस हिस्से को केस डायरी में लिखकर ✓ करें।' };
  });
  return [overview, ...parts];
}

/** Extra sections for the cards folded into an existing card (पंचनामा व पोस्टमार्टम). */
export function foldedCardSections(mergedCodesRaw: string | null | undefined): KnowledgeSection[] {
  const t = texts();
  return codesOf(mergedCodesRaw).map((c) => {
    const st = t.get(c);
    return { title: `＋ ${st?.task_name ?? c}`, body: stepBody(st) };
  }).filter((s) => s.body.trim() !== '');
}
