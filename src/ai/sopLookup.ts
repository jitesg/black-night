/**
 * sopLookup.ts
 *
 * Dedicated search, ranking, and response formatter for UP Police SOPs.
 * Part of Task L29 (SOP Library Part 1).
 */

import { search as searchSopIndex, getAll as getAllSops, getById as getSopById, type SopIndexEntry, type SopStep } from './sopIndex';
import { getExplain, memParts, type SopExplain } from './sopExplain';

export interface SopLookupResult {
  content: string;
  suggestedActions: string[];
  matchedSopId?: string;
  matchedSopKid?: string;
}

function hasStatutorySectionRef(text: string): boolean {
  return (
    /\b(?:bns|bnss|bsa|ipc|crpc|iea)\s*[-:]?\s*\d+/i.test(text) ||
    /\b(?:धारा|section)\s*\d+\s*(?:bns|bnss|bsa|ipc|crpc|iea)?/i.test(text)
  );
}

/**
 * Check if a query targets SOP lookup.
 * Must NOT steal law questions (e.g. "BNS 103 kya hai").
 */
export function isSopLookupQuery(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();

  // Guard: if it's an explicit statutory section definition query, let law-lookup handle it
  // e.g. "BNS 103 kya hai", "dhara 103 BNS", "what is BSA 63", "BNS 103 ki saza"
  if (
    hasStatutorySectionRef(query) &&
    /(kya hai|kya bolta|paribhasha|definition|saza|punishment|bailable|jamanati|non-bailable|what is)/i.test(q)
  ) {
    return false;
  }
  if (/^(bns|bnss|bsa)\s*\d+.*(kya hai|kya bolta|saza)/i.test(q)) {
    return false;
  }

  // Explicit SOP triggers
  if (
    /\b(sop|sops|mani|manak prakriya|mānak prakriya|मानक प्रक्रिया|चेकलिस्ट|checklist|step by step|चरणबद्ध)\b/i.test(
      q
    )
  ) {
    return true;
  }

  // Investigation phrase triggers
  if (
    /(vivechna\s*kaise\s*kare|investigation\s*kaise\s*kare|kya\s*kya\s*karna\s*chahiye|kaise\s*kare\s*vivechna|विवेचना\s*कैसे\s*करें|जाँच\s*कैसे\s*करें|क्या\s*क्या\s*करना\s*चाहिए|कार्यवाही\s*कैसे)/i.test(
      q
    )
  ) {
    return true;
  }

  // Explainer-style questions (L32): samjhao / explain / kyu / galti about
  // an investigation topic
  if (/(pooch-?\s*tachh|poochtach|puchh?-?tachh|interrogation)/i.test(q)) {
    return true;
  }
  if (/(samjhao|samjha\s*do|explain|kyu|kyon|galti|galtiyan|mistake)/i.test(q) &&
      /(hatya|murder|balatkar|rape|chori|theft|loot|lut|dakaiti|ghatnasthal|crime\s*scene|vivechna|investigation|gawah|giraftari|medical|lab|fsl)/i.test(q)) {
    return true;
  }

  // Specific crime + action patterns
  // hatya/murder
  if (/(hatya.*(suchna|kaise|kya karna|checklist|prakriya|kadam)|murder.*(investigation|scene|checklist))/i.test(q)) {
    return true;
  }
  // mobile seize / digital evidence
  if (/(mobile\s*seize|phone\s*seize|digital\s*evidence|faraday|hash\s*value|इलेक्ट्रॉनिक\s*साक्ष्य|डिजिटल\s*साक्ष्य)/i.test(q)) {
    return true;
  }
  // snatching
  if (/(snatching|chain\s*snatching|स्नेचिंग|झपटमारी)/i.test(q)) {
    return true;
  }
  // balatkar/rape
  if (/(balatkar.*(vivechna|kaise|checklist|medical)|rape.*(investigation|medical|checklist)|बलात्कार.*(विवेचना|निर्देश|दिशा-निर्देश))/i.test(q)) {
    return true;
  }
  // missing / unidentified body
  if (/(gumshuda.*(kaise|proforma|prpatra)|ajnat\s*shav|अज्ञात\s*शव|खोये\s*हुए)/i.test(q)) {
    return true;
  }
  // counterfeit
  if (/(jali\s*note|fake\s*currency|जाली\s*मुद्रा|जाली\s*नोट)/i.test(q)) {
    return true;
  }
  // kidnapping / ransom
  if (/(phirauti|फिरौती|apaharan.*(kaise|vivechna|phirauti))/i.test(q)) {
    return true;
  }
  // dacoity / robbery
  if (/(dacoity.*(vivechna|kaise|sop)|lut.*(vivechna|kaise|sop)|डकैती.*विवेचना|लूट.*विवेचना)/i.test(q)) {
    return true;
  }
  // hit and run / accident
  if (/(hit\s*and\s*run|दुर्घटना\s*कर\s*भागने|vahan\s*chori.*vivechna|वाहन\s*चोरी.*विवेचना)/i.test(q)) {
    return true;
  }
  // riot / balwa
  if (/(balwa.*(apradh|kaise|karyawahi)|दंगा.*विवेचना|बलवा.*कार्यवाही)/i.test(q)) {
    return true;
  }
  // fraud / cheating
  if (/(dhokhadhadi.*(kaise|vivechna|mukadme)|धोखाधड़ी.*विवेचना)/i.test(q)) {
    return true;
  }
  // dowry / 498A
  if (/(pati\s*utpidan|पति\s*द्वारा\s*उत्पीड़न|dahej.*(kaise|vivechna)|498a.*(kaise|vivechna))/i.test(q)) {
    return true;
  }
  // criminal breach of trust
  if (/(nyas\s*bhang|apradhik\s*nyas\s*bhang|न्यास\s*भंग)/i.test(q)) {
    return true;
  }
  // acid attack
  if (/(acid\s*attack|tezaab.*hamla|अम्ल\s*हमला|एसिड\s*अटैक)/i.test(q)) {
    return true;
  }
  // crime scene / csi / csm / coc / dna
  if (/(ghatnasthal.*(nirikshan|prabandhan|kaise)|crime\s*scene.*(management|inspection)|chain\s*of\s*custody|चेन\s*ऑफ\s*कस्टडी|dna\s*fingerprinting|डीएनए\s*फिंगर)/i.test(q)) {
    return true;
  }
  // interrogation / expert opinion
  if (/(poochtachh.*manak|apradhiyo\s*se\s*poochtachh|interrogation\s*sop|visheshagya.*mantavya|विशेषज्ञ.*मन्तव्य)/i.test(q)) {
    return true;
  }

  return false;
}

/**
 * Format a single SOP entry into structured Copilot output.
 */
function formatSopEntry(sop: SopIndexEntry): string {
  const lines: string[] = [];

  // (a) SOP title + source chip
  lines.push(`### 📋 ${sop.title}`);
  lines.push(`🏷️ **स्रोत:** \`${sop.src}\` | **अपराध श्रेणी:** **${sop.crime}**\n`);

  // (b) Top 8 steps from steps (those with must:1 first, marked "✱")
  const mustSteps = sop.steps.filter((s) => s.must === 1);
  const otherSteps = sop.steps.filter((s) => s.must !== 1 && s.dont !== 1);
  const selectedSteps = [...mustSteps, ...otherSteps].slice(0, 8);

  if (selectedSteps.length > 0) {
    lines.push(`#### 📌 मुख्य जाँच चरण (Key Steps):`);
    selectedSteps.forEach((st, idx) => {
      const isMust = st.must === 1;
      const marker = isMust ? '✱ ' : '';
      lines.push(`${idx + 1}. ${marker}${st.t}`);
    });
    lines.push('');
  }

  // (c) "ध्यान रखें / न करें" = up to 4 steps with dont:1
  const dontSteps = sop.steps.filter((s) => s.dont === 1).slice(0, 4);
  if (dontSteps.length > 0) {
    lines.push(`#### ⚠️ ध्यान रखें / न करें (Cautions):`);
    dontSteps.forEach((st) => {
      lines.push(`- 🚫 ${st.t}`);
    });
    lines.push('');
  }

  // (d) laws "IPC 302 → BNS 103" (max 6)
  if (sop.laws && sop.laws.length > 0) {
    lines.push(`#### ⚖️ संबंधित धाराएँ (पुरानी → नई):`);
    const displayLaws = sop.laws.slice(0, 6);
    displayLaws.forEach((l) => {
      lines.push(`- **${l.old}** → \`${l.new.join(', ')}\``);
    });
    lines.push('');
  }

  // (e) related circulars
  if (sop.circ && sop.circ.length > 0) {
    lines.push(`#### 📜 संबंधित परिपत्र / आदेश:`);
    sop.circ.forEach((c) => {
      if (c.id) {
        lines.push(`- 📄 **DG परिपत्र ${c.n}** (ऐप में उपलब्ध)`);
      } else {
        lines.push(`- 📄 DG परिपत्र ${c.n} (ऐप में नहीं)`);
      }
    });
    lines.push('');
  }

  // (f) button "पूरा SOP खोलें" and "चेकलिस्ट खोलें"
  lines.push(`[📖 पूरा SOP खोलें](sop:${sop.kid})  [✅ चेकलिस्ट खोलें](sop_checklist:${sop.kid})\n`);

  // (g) amber line
  lines.push(`⚠️ _पुस्तिका सारांश — मूल आदेश से मिलान करें_`);

  return lines.join('\n');
}

// ── Explainer-based answer (L32) ─────────────────────────────────────────────
// Hinglish words → Hindi words found in phase titles / "how" bullets.
const PHASE_HINTS: Array<[RegExp, string[]]> = [
  [/(pehl[ae]|pahl[ae]|ghant[ae]|turant|first\s*hour)/i, ['पहला', 'पहले', 'घंटा', 'तुरंत', 'मिनट']],
  [/(gawa?h|gavah|bayan|bayaan|statement|witness)/i, ['गवाह', 'बयान']],
  [/(giraft?ar|arrest|aaropi|aropi|accused|gunah?gar|abhiyukt)/i, ['आरोपी', 'गिरफ्तारी', 'पकड़']],
  [/(\blab\b|fsl|report|dna|vishesh|forensic)/i, ['लैब', 'रिपोर्ट', 'FSL', 'DNA']],
  [/(charge\s*sheet|chargesheet|aarop\s*patra|arop\s*patra)/i, ['चार्जशीट', 'आरोप-पत्र']],
  [/(medical|doctor|daktar|jaanch|janch)/i, ['मेडिकल', 'डॉक्टर']],
  [/(ghatnasthal|scene|mauk[ae]|spot|crime\s*scene)/i, ['घटनास्थल', 'सीन', 'मौके']],
  [/(pooch|puchh|poochtachh|interrogat)/i, ['पूछताछ', 'बातचीत', 'तैयारी']],
  [/(seal|packing|paik|sil\b)/i, ['पैकिंग', 'सील']],
  [/(gher|nakab|naka|cordon)/i, ['घेर', 'नाके']],
];

function pickPhase(explain: SopExplain, query: string): number {
  let best = 0;
  let bestScore = 0;
  const words = PHASE_HINTS.filter(([re]) => re.test(query)).flatMap(([, hi]) => hi);
  if (words.length === 0) return 0;
  explain.phases.forEach((ph, i) => {
    const hay = `${ph.t} ${ph.goal} ${ph.how.join(' ')}`;
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function formatExplainEntry(sop: SopIndexEntry, explain: SopExplain, query: string): string {
  const lines: string[] = [];
  lines.push(`### 📋 ${sop.title}`);
  lines.push(`**⏱ 30 सेकंड में:** ${explain.tl}\n`);
  const mem = memParts(explain.mem);
  if (mem.length) lines.push(`🧠 **याद-सूत्र:** ${mem.join(' → ')}\n`);

  lines.push('#### 🗺 चरण');
  explain.phases.forEach((ph, i) => lines.push(`${i + 1}. ${ph.ic} ${ph.t} — _${ph.time}_`));
  lines.push('');

  const pi = pickPhase(explain, query);
  const ph = explain.phases[pi];
  if (ph) {
    lines.push(`#### ${ph.ic} ${ph.t}: कैसे करें`);
    ph.how.forEach((h) => lines.push(`- ✔ ${h}`));
    lines.push('');
  }

  const wantsMistakes = /(galti|galtiyan|galtiya|mistake|chook|chuk)/i.test(query);
  const mist = wantsMistakes ? explain.mist : explain.mist.slice(0, 2);
  if (mist.length) {
    lines.push('#### ⚖ ये गलतियाँ भारी पड़ती हैं');
    mist.forEach((m) => lines.push(`- ✗ ${m.m} → ${m.r}`));
    lines.push('');
  }

  lines.push(`[🧠 समझें खोलें](sop_samjhe:${sop.kid})  [✅ चेकलिस्ट खोलें](sop_checklist:${sop.kid})  [📖 पूरा SOP](sop:${sop.kid})\n`);
  lines.push(`⚠️ _पुस्तिका सारांश — मूल आदेश से मिलान करें_`);
  return lines.join('\n');
}

/** Uses the explainer when the SOP has one, else the booklet summary. */
function formatAnswer(sop: SopIndexEntry, query: string): string {
  const explain = getExplain(sop.id);
  return explain ? formatExplainEntry(sop, explain, query) : formatSopEntry(sop);
}

/**
 * Main execution function for SOP_LOOKUP intent.
 */
export async function lookupSop(query: string): Promise<SopLookupResult> {
  const matches = searchSopIndex(query, 5);

  if (matches.length === 0) {
    // Fallback: return generic SOP listing
    const all = getAllSops();
    return {
      content: [
        '### 📋 मानक संचालन प्रक्रिया (SOP) खोज\n',
        'आपके प्रश्न से संबंधित सटीक SOP नहीं मिला। ऐप में 38 SOP उपलब्ध हैं:',
        '- 22 मानक प्रक्रियाएँ — विवेचना (22)',
        '- UP पुलिस विवेचना हस्त-पुस्तिका (DGP O.P. Singh) (9)',
        '- FSL/तकनीकी सेवाएँ — Crime Scene SOP (5)\n',
        'आप अपराध का नाम (उदा. हत्या, बलात्कार, स्नेचिंग, साइबर, डिजिटल साक्ष्य) लिखकर पुनः पूछ सकते हैं।\n',
        '⚠️ _पुस्तिका सारांश — मूल आदेश से मिलान करें_',
      ].join('\n'),
      suggestedActions: ['पूरा SOP खोलें', 'हत्या SOP', 'डिजिटल साक्ष्य SOP'],
    };
  }

  const primary = matches[0];
  const suggestedActions: string[] = [
    ...(getExplain(primary.id) ? [`समझें खोलें (${primary.kid})`] : []),
    `पूरा SOP खोलें (${primary.kid})`,
    `चेकलिस्ट खोलें (${primary.kid})`,
  ];

  // If 2+ SOPs match, show a chooser of max 3
  if (matches.length >= 2) {
    const topMatches = matches.slice(0, 3);
    const chooserLines: string[] = [];
    chooserLines.push(`🔍 आपके प्रश्न से **${topMatches.length} SOP** संबंधित मिले:\n`);

    topMatches.forEach((m, idx) => {
      chooserLines.push(
        `${idx + 1}. **${m.title}** (\`${m.src}\`) — *${m.crime}* [🔗 खोलें](sop:${m.kid})`
      );
    });
    chooserLines.push('\n---\n');
    chooserLines.push(formatAnswer(primary, query));

    topMatches.slice(1).forEach((m) => {
      suggestedActions.push(`पूरा SOP खोलें (${m.kid})`);
    });

    return {
      content: chooserLines.join('\n'),
      suggestedActions,
      matchedSopId: primary.id,
      matchedSopKid: primary.kid,
    };
  }

  return {
    content: formatAnswer(primary, query),
    suggestedActions,
    matchedSopId: primary.id,
    matchedSopKid: primary.kid,
  };
}
