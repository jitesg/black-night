/**
 * sceneKnowledge.ts — the reading text ("जानकारी") of the one "घटनास्थल निरीक्षण" card (owner).
 *
 * The separate cards merged into its checklist (सुरक्षा, फोटो-वीडियोग्राफी, ई-साक्ष्य, नक्शा नजरी and the हत्या /
 * हत्या का प्रयास ones) are no longer added to new FIRs, so their texts are NOT dropped — they are shown here,
 * part by part, built live from the same playbook / default-karyvahi data.
 */
import type { KnowledgeSection } from '@/lib/defaultKaryvahiKnowledge';
import type { DefaultKnowledge } from '@/lib/defaultKaryvahiKnowledge';
import { RAW as SHARED1_RAW } from '@/lib/db/playbooks/shared1';
import { parseStepLines } from '@/lib/db/playbooks/parse';
import { MURDER_STEPS } from '@/lib/db/playbooks/murder';
import { ATTEMPT_MURDER_STEPS } from '@/lib/db/playbooks/attemptMurder';
import { PLAYBOOK_TEXTS } from '@/lib/db/playbooks/playbookTexts';

interface StepText {
  why_text?: string; court_text?: string; legal_basis?: string; care_text?: string; risk_text?: string;
  steps_text?: string; docs_text?: string; condition_note?: string;
}

function line(label: string, text?: string | null): string {
  const t = String(text ?? '').trim();
  return t ? `${label}: ${t}` : '';
}

function block(label: string, text?: string | null): string {
  const t = String(text ?? '').trim();
  return t ? `${label}:\n${t}` : '';
}

/** One playbook card's texts as labelled lines. */
function stepBody(s: StepText | undefined): string {
  if (!s) return '';
  return [
    line('क्यों ज़रूरी', s.why_text),
    line('न्यायालय में', s.court_text),
    line('कानूनी आधार', s.legal_basis),
    block('कैसे करें', s.steps_text),
    block('दस्तावेज़', s.docs_text),
    line('सावधानी', s.care_text),
    line('आम गलतियाँ', s.risk_text),
  ].filter(Boolean).join('\n\n');
}

function defaultBody(d: DefaultKnowledge | null): string {
  if (!d) return '';
  return [
    line('क्या करना है', d.what),
    line('कब करें', d.when),
    line('क्यों ज़रूरी', d.why),
    line('कानूनी आधार', d.legal),
    block('कैसे करें', d.steps),
    block('दस्तावेज़', d.docs),
    line('सावधानी', d.care),
    line('आम गलतियाँ', d.risk),
  ].filter(Boolean).join('\n\n');
}

let cache: KnowledgeSection[] | null = null;

/**
 * Sections for the "घटनास्थल निरीक्षण" card: overview + ① निरीक्षण ② सुरक्षा ③ फोटो-वीडियो ④ ई-साक्ष्य ⑤ नक्शा नजरी.
 * `getDefault` = getDefaultKnowledge (passed in to avoid an import cycle).
 */
export function sceneKnowledgeSections(getDefault: (key: string) => DefaultKnowledge | null): KnowledgeSection[] {
  if (cache) return cache;
  const shared = new Map(parseStepLines(SHARED1_RAW).map((s) => [s.step_code, s as StepText]));
  const withTexts = (rows: Array<{ step_code: string } & StepText>, code: string): StepText | undefined => {
    const r = rows.find((x) => x.step_code === code);
    return r ? { ...r, ...(PLAYBOOK_TEXTS[code] ?? {}) } : undefined;
  };
  const murder = (code: string) => withTexts(MURDER_STEPS as never, code);
  const attempt = (code: string) => withTexts(ATTEMPT_MURDER_STEPS as never, code);
  const extra = (title: string, body: string) => (body ? `\n\n— ${title} —\n${body}` : '');

  cache = [
    {
      title: 'इस कार्यवाही में क्या-क्या है',
      body: [
        'घटनास्थल की सारी कार्यवाही एक ही कार्ड में है — अंदर 5 हिस्सों की चेकलिस्ट:',
        '1. घटनास्थल निरीक्षण (वैकल्पिक)',
        '2. घटनास्थल की सुरक्षा (वैकल्पिक)',
        '3. फोटो-वीडियोग्राफी (वैकल्पिक)',
        '4. ई-साक्ष्य से फोटो-वीडियोग्राफी (ज़रूरी)',
        '5. नक्शा नजरी (ज़रूरी)',
        '',
        '4 और 5 केस डायरी के प्रारूप "निरीक्षण घटना स्थल (नक्शा नजरी व ई-साक्ष्य वीडियोग्राफी)" को save करते ही पर्चा नंबर के साथ अपने आप ✓ हो जाते हैं (साथ में 1 भी)। 1–3 नैरेटिव में लिखें या कार्ड की चेकलिस्ट पर ✓ लगाएँ।',
        'कार्यवाही 4 और 5 होने पर पूरी मानी जाती है। मुकदमे के 3 दिन बाद तक न हो तो 🔔 सूचना आती है।',
      ].join('\n'),
    },
    {
      title: '① घटनास्थल निरीक्षण',
      body: defaultBody(getDefault('GHATNASTHAL')) + extra('हत्या का प्रयास में', stepBody(attempt('ATM_SPOT'))),
    },
    {
      title: '② घटनास्थल की सुरक्षा',
      body: stepBody(shared.get('COM_SCENE_SECURE')) + extra('हत्या में', stepBody(murder('MUR_SCENE_SECURE'))),
    },
    {
      title: '③ फोटो-वीडियोग्राफी',
      body: stepBody(shared.get('COM_SCENE_PHOTO')) + extra('हत्या में', stepBody(murder('MUR_SCENE_PHOTO'))),
    },
    {
      title: '④ ई-साक्ष्य से फोटो-वीडियोग्राफी',
      body: defaultBody(getDefault('ESAKSHYA')),
    },
    {
      title: '⑤ नक्शा नजरी',
      body: stepBody(shared.get('COM_SITE_PLAN')) + extra('हत्या में', stepBody(murder('MUR_SITE_PLAN'))),
    },
  ].filter((s) => s.body.trim() !== '');
  return cache;
}
