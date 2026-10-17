import { logger } from '@/lib/logger';
import { fmtSteps, fmtDocs } from '@/lib/db/playbooks/playbookTexts';
import { matchDefaultKaryvahi, type DefaultKaryvahiKey } from '@/lib/karyvahiNames';
import type { ChecklistItem } from '@/lib/db/checklistRepo';
import i18n from '@/lib/i18n';

export interface DefaultKnowledge {
  key: string;
  what: string;
  when: string;
  why: string;
  legal: string;
  steps: string;
  docs: string;
  care: string;
  risk: string;
}

export interface KnowledgeSection {
  title: string;
  body: string;
}

export const DEFAULT_KNOWLEDGE_RAW = `NAKAL_CHIK | प्रथम सूचना रिपोर्ट (चिक) की प्रति को मूल सूचना/तहरीर से मिलाकर सत्यापित करना और उसकी मुख्य बातें विवेचना का आधार बनाना। | मुकदमा दर्ज होते ही, विवेचना शुरू करने से पहले (पहले 24 घंटे में)। | चिक में दर्ज धाराएँ, घटना का समय-स्थान, वादी-आरोपी का विवरण पूरी विवेचना की आधार रेखा है; यहाँ की गलती आगे हर कार्यवाही में दोहराई जाती है। केस डायरी में बाद के सभी तथ्य इसी से मिलाए जाते हैं। | प्रथम सूचना दर्ज करना और उसकी प्रति सूचनाकर्ता को देना BNSS का प्रावधान है; प्रविष्टि में त्रुटि हो तो सुधार का लिखित रिकॉर्ड रखें। | नकल चिक की प्रति लेकर वादी की तहरीर/सूचना से मिलाएँ ¶ धाराएँ, घटना की तारीख-समय, स्थान, वादी व आरोपी के नाम-पते जाँचें ¶ घटना और सूचना के बीच देरी हो तो उसका कारण लिखें ¶ अंतर मिले तो वरिष्ठ को बताकर लिखित सुधार कराएँ ¶ मुख्य तथ्य (धारा, तारीख, समय, स्थान) केस डायरी के आधार के रूप में नोट करें | नकल चिक की प्रति ¶ वादी की तहरीर ¶ जीडी की संबंधित प्रविष्टि ¶ सुधार पत्र (यदि हुआ) | चिक में कटिंग या ओवरराइटिंग न हो; धाराएँ घटना के तथ्यों से मेल खाएँ; घटना व सूचना का समय अलग-अलग साफ़ लिखा हो। | बिना पढ़े प्रति लगा देना, देरी का कारण न लिखना, बाद में धारा जोड़ने पर आधार न लिखना।
NAKAL_RAPAT | थाने की जीडी (रोज़नामचा) में मुकदमे की रपट की प्रविष्टि की प्रति देखकर चिक से उसका मिलान करना। | चिक के अवलोकन के साथ ही, पहले दिन। | रपट में सूचना मिलने का समय, क्रमांक, ड्यूटी अधिकारी और विवेचक की रवानगी दर्ज होती है; यह चिक के समय से मेल खाना चाहिए, वरना समय पर सवाल उठता है। | जीडी का रिकॉर्ड पुलिस का आधिकारिक अभिलेख है; इसमें अंतर होने पर कारण का रिकॉर्ड रखना ज़रूरी है। | जीडी की संबंधित प्रविष्टि की नकल लें ¶ क्रमांक, समय और ड्यूटी अधिकारी देखें ¶ चिक के समय से मिलान करें ¶ विवेचक की रवानगी और पहुँचने का समय दर्ज है या नहीं देखें ¶ अंतर हो तो कारण लिखें और वरिष्ठ को बताएँ | जीडी की नकल ¶ रवानगी/वापसी की प्रविष्टि ¶ नकल चिक की प्रति | चिक और रपट के समय में अंतर हो तो तुरंत स्पष्टीकरण लिखें; रवानगी का समय छूटे नहीं। | समय के अंतर को नज़रअंदाज़ करना, रवानगी की प्रविष्टि न देखना।
VADI_BAYAN | वादी/वादिनी या पीड़ित का विस्तृत बयान उसके अपने शब्दों में दर्ज करना। | जितनी जल्दी हो सके, पहले 24 घंटे में। | बयान घटना, आरोपी की भूमिका और गवाहों-साक्ष्य की पूरी तस्वीर देता है; एफआईआर से मेल न खाने पर बचाव पक्ष इसी का लाभ उठाता है। | BNSS 180 (पुलिस द्वारा गवाह का बयान); जहाँ ज़रूरी हो BNSS 183 में मजिस्ट्रेट के समक्ष बयान। | वादी को शांत जगह पर बैठाएँ ¶ घटना का क्रम तारीख-समय सहित उसके शब्दों में लिखें ¶ आरोपी का नाम, हुलिया, भूमिका और गवाह-साक्ष्य पूछें ¶ नकल चिक से मिलान करें ¶ पढ़कर सुनाएँ और वादी से बयान सही होने की पुष्टि लें (BNSS 181 के अनुसार बयान पर हस्ताक्षर नहीं कराए जाते) | बयान (BNSS 180) ¶ BNSS 183 का बयान (यदि कराया) ¶ वादी का पहचान पत्र | महिला पीड़िता का बयान महिला अधिकारी लें; चिक की बातों से अंतर हो तो कारण पूछकर लिखें। | अपनी भाषा थोपना, चिक से अलग बात बिना कारण लिखना, पढ़कर सुनाए बिना बयान बंद कर देना।
GHATNASTHAL | घटना की जगह का निरीक्षण कर साक्ष्य सुरक्षित करना और उसका पंचनामा/नक्शा बनाना। | जगह बिगड़ने से पहले, मुकदमा दर्ज होते ही पहले कुछ घंटों में। | घटनास्थल का स्थायी रिकॉर्ड बनता है, साक्ष्य मिलते हैं और गवाह की बताई जगह से मिलान होता है। | BNSS 176 के प्रावधान और फॉरेंसिक/वीडियोग्राफी का पालन; पंचनामा स्वतंत्र गवाहों के सामने। | घटनास्थल की घेराबंदी करें ¶ वाइड, मिड और क्लोज़-अप फोटो/वीडियो लें ¶ साक्ष्य की स्थिति मापकर नक्शा बनाएँ ¶ साक्ष्य उठाकर सील करें ¶ दो स्वतंत्र गवाहों के सामने पंचनामा बनाएँ | पंचनामा ¶ नक्शा नजरी ¶ फोटो/वीडियो ¶ सीलिंग पर्ची | जगह वही हो जो नकल चिक में दर्ज है; स्थान का अंतर हो तो कारण लिखें। | भीड़ को अंदर आने देना, नक्शा अंदाज़े से बनाना, गवाह पुलिस के ही लोग होना।
ESAKSHYA | घटनास्थल निरीक्षण, तलाशी या जब्ती की ई-साक्ष्य ऐप से बिना रुके वीडियोग्राफी करना। | घटनास्थल निरीक्षण, तलाशी, जब्ती और बरामदगी के समय। | वीडियोग्राफी से कार्यवाही का निष्पक्ष, समयबद्ध प्रमाण बनता है और बाद में विवाद नहीं रहता। | BNSS 105 (तलाशी/जब्ती की ऑडियो-वीडियो रिकॉर्डिंग) और BSA 63 का प्रमाणपत्र। | ऐप अद्यतन व बैटरी देख लें ¶ पूरी कार्यवाही बिना रोके रिकॉर्ड करें ¶ मौके पर बोलकर स्थान, समय और उपस्थित लोग बताएँ ¶ निर्धारित समय में पोर्टल पर अपलोड करें ¶ अपलोड की रसीद सुरक्षित रखें | ई-साक्ष्य ऐप की रिकॉर्डिंग ¶ अपलोड रसीद ¶ BSA 63 प्रमाणपत्र | वीडियो बीच में न रुके; जिस कार्यवाही का पंचनामा बने उसकी रिकॉर्डिंग अलग फ़ाइल में रखें। | रिकॉर्डिंग बीच में रोकना, अपलोड में देरी, पंचनामा से समय का मेल न होना।`;

export const DEFAULT_KNOWLEDGE_EN_RAW = `NAKAL_CHIK | Verify the FIR (chik) copy against the original information/complaint and note its key facts as the basis of the investigation. | As soon as the case is registered, before investigation starts (within the first 24 hours). | Sections, date/time/place of occurrence and complainant/accused details in the FIR are the baseline of the whole investigation; an error here repeats in every later step. All case diary facts are checked against it. | Registering the FIR and giving its copy to the informant is a BNSS requirement; keep a written record of any correction. | Take the FIR copy and compare it with the complainant's written information ¶ Check sections, date-time and place of occurrence, complainant and accused names/addresses ¶ If there is a delay between occurrence and report, record the reason ¶ If a mismatch is found, inform the senior officer and get a written correction ¶ Note key facts (section, date, time, place) as the basis for the case diary | FIR copy ¶ Complainant's written information ¶ Related GD entry ¶ Correction letter (if any) | No cutting or overwriting in the FIR; sections must fit the facts; occurrence time and reporting time clearly separate. | Filing the copy without reading it, not recording the reason for delay, adding a section later without recording the basis.
NAKAL_RAPAT | Check the copy of the police station GD (daily diary) entry for the case and match it with the FIR. | Along with the FIR review, on day one. | The entry records time of information, serial number, duty officer and investigator's departure; it must match the FIR time or the timeline is questioned. | The GD is the official police record; if it differs, keep a record of the reason. | Take a copy of the relevant GD entry ¶ Check serial number, time and duty officer ¶ Match with the FIR time ¶ Check that the investigator's departure and arrival times are recorded ¶ If different, write the reason and inform the senior officer | GD copy ¶ Departure/return entry ¶ FIR copy | If FIR and GD times differ, write an explanation immediately; do not miss the departure time. | Ignoring a time gap, not checking the departure entry.
VADI_BAYAN | Record the complainant's/victim's detailed statement in their own words. | As early as possible, within the first 24 hours. | The statement gives the full picture of the incident, the accused's role and witnesses/evidence; if it does not match the FIR, the defence uses that. | BNSS 180 (police examination of witnesses); where needed, BNSS 183 statement before a magistrate. | Seat the complainant in a calm place ¶ Write the sequence of events with date-time in their words ¶ Ask the accused's name, description, role, and witnesses/evidence ¶ Match with the FIR ¶ Read it back and get the complainant's confirmation (statements to police are not signed, BNSS 181) | Statement (BNSS 180) ¶ BNSS 183 statement (if done) ¶ Complainant's ID | A woman victim's statement should be taken by a woman officer; if it differs from the FIR, ask why and record it. | Imposing one's own words, writing something different from the FIR without reason, closing the statement without reading it back.
GHATNASTHAL | Inspect the crime scene, secure evidence and prepare the panchnama/site map. | Before the scene is disturbed, within the first hours of registration. | Creates a permanent record of the scene, yields evidence, and matches the place pointed out by witnesses. | BNSS 176 provisions and forensic/videography compliance; panchnama before independent witnesses. | Cordon off the scene ¶ Take wide, mid and close-up photos/video ¶ Measure evidence positions and draw the map ¶ Collect and seal evidence ¶ Prepare the panchnama before two independent witnesses | Panchnama ¶ Site map ¶ Photos/video ¶ Seal slip | The place must match the FIR; if it differs, record the reason. | Letting crowds in, drawing the map by estimate, using only police personnel as witnesses.
ESAKSHYA | Videograph the scene inspection, search or seizure continuously with the e-Sakshya app. | During scene inspection, search, seizure and recovery. | Videography gives fair, time-stamped proof of the proceedings and prevents later disputes. | BNSS 105 (audio-video recording of search/seizure) and BSA 63 certificate. | Check app update and battery ¶ Record the entire proceeding without a break ¶ Say aloud the place, time and persons present ¶ Upload on the portal within the prescribed time ¶ Keep the upload receipt | e-Sakshya recording ¶ Upload receipt ¶ BSA 63 certificate | Video must not stop midway; keep the recording for each panchnama as a separate file. | Stopping the recording, delaying the upload, panchnama time not matching.`;

function parseDefaultKnowledge(raw: string): Map<string, DefaultKnowledge> {
  const map = new Map<string, DefaultKnowledge>();
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(' | ');
    if (parts.length !== 9) {
      logger.warn('[defaultKaryvahiKnowledge] Malformed line (expected 9 fields):', trimmed);
      continue;
    }
    const [key, what, when, why, legal, steps, docs, care, risk] = parts.map((p) => p.trim());
    const clean = (val: string) => (val === '-' ? '' : val);

    map.set(key, {
      key,
      what: clean(what),
      when: clean(when),
      why: clean(why),
      legal: clean(legal),
      steps: clean(steps) ? fmtSteps(steps) : '',
      docs: clean(docs) ? fmtDocs(docs) : '',
      care: clean(care),
      risk: clean(risk),
    });
  }
  return map;
}

const KNOWLEDGE_CACHE_HI = parseDefaultKnowledge(DEFAULT_KNOWLEDGE_RAW);
const KNOWLEDGE_CACHE_EN = parseDefaultKnowledge(DEFAULT_KNOWLEDGE_EN_RAW);

const DEFAULT_KEY_ALIAS_MAP: Record<string, string> = {
  nakalchick: 'NAKAL_CHIK',
  nakal_chik: 'NAKAL_CHIK',
  nakalchik: 'NAKAL_CHIK',
  nakalrapat: 'NAKAL_RAPAT',
  nakal_rapat: 'NAKAL_RAPAT',
  bayanvadi: 'VADI_BAYAN',
  vadi_bayan: 'VADI_BAYAN',
  vadibayan: 'VADI_BAYAN',
  ghatnasthal: 'GHATNASTHAL',
  videography: 'ESAKSHYA',
  esakshya: 'ESAKSHYA',
  e_sakshya: 'ESAKSHYA',
};

function resolveCanonicalKey(key: string | DefaultKaryvahiKey | null | undefined): string | null {
  if (!key) return null;
  const upper = key.trim().toUpperCase();
  if (KNOWLEDGE_CACHE_HI.has(upper)) {
    return upper;
  }
  const normalized = key.trim().toLowerCase().replace(/[\s_-]/g, '');
  const alias = DEFAULT_KEY_ALIAS_MAP[normalized];
  if (alias && KNOWLEDGE_CACHE_HI.has(alias)) {
    return alias;
  }
  for (const k of KNOWLEDGE_CACHE_HI.keys()) {
    if (k.toLowerCase().replace(/[\s_-]/g, '') === normalized) {
      return k;
    }
  }
  return null;
}

/**
 * Returns default knowledge for one of the 5 mandatory default karyvahi.
 * Returns English text when app language (or passed lang) is English, else Hindi.
 * Falls back to Hindi per field if English is '-' or missing.
 */
export function getDefaultKnowledge(
  key: string | DefaultKaryvahiKey | null | undefined,
  lang?: string
): DefaultKnowledge | null {
  if (!key) return null;
  const canonicalKey = resolveCanonicalKey(key);
  if (!canonicalKey) return null;

  const hiItem = KNOWLEDGE_CACHE_HI.get(canonicalKey);
  if (!hiItem) return null;

  const currentLang = (lang || i18n?.language || 'hi').toLowerCase();
  const isEn = currentLang.startsWith('en');

  if (!isEn) {
    return hiItem;
  }

  const enItem = KNOWLEDGE_CACHE_EN.get(canonicalKey);
  if (!enItem) {
    return hiItem;
  }

  const pick = (enVal?: string, hiVal?: string): string => {
    const trimmed = enVal?.trim();
    if (!trimmed || trimmed === '-') {
      return hiVal || '';
    }
    return trimmed;
  };

  return {
    key: canonicalKey,
    what: pick(enItem.what, hiItem.what),
    when: pick(enItem.when, hiItem.when),
    why: pick(enItem.why, hiItem.why),
    legal: pick(enItem.legal, hiItem.legal),
    steps: pick(enItem.steps, hiItem.steps),
    docs: pick(enItem.docs, hiItem.docs),
    care: pick(enItem.care, hiItem.care),
    risk: pick(enItem.risk, hiItem.risk),
  };
}

export function deriveKnowledgeSections(name: string, description?: string): KnowledgeSection[] {
  const n = name.toLowerCase();
  const defKey = matchDefaultKaryvahi(name);
  const defKnowledge = defKey ? getDefaultKnowledge(defKey) : null;
  const desc = defKnowledge?.what || description;
  return [
    {
      title: 'Why This Step Is Required',
      body: desc?.trim() ||
        'This investigation step is mandated under standard operating procedure for thorough inquiry.',
    },
    {
      title: 'When to Perform',
      body: defKey === 'bayanVadi' || n.includes('statement')
        ? 'Record witness/victim statements as early as possible — preferably within 24 hours of the report.'
        : defKey === 'ghatnasthal' || n.includes('scene')
          ? 'Conduct site inspection before the scene is disturbed, ideally within hours of registration.'
          : defKey === 'videography' || n.includes('video')
            ? 'Perform videography during scene inspection or any important procedural step requiring visual documentation.'
            : defKey === 'nakalChick' || defKey === 'nakalRapat' || n.includes('record')
              ? 'Review FIR/police records promptly after registration to verify entries and flag discrepancies.'
              : 'Perform this step as part of the systematic investigation sequence established at the outset.',
    },
    {
      title: 'Legal Importance',
      body: 'Proper execution of this step supports admissibility of evidence and compliance with the Bharatiya Nagarik Suraksha Sanhita (BNSS) investigation provisions.',
    },
    {
      title: 'Investigation Steps',
      body: defKey === 'bayanVadi'
        ? '1. Inform the witness/victim of their right to have a support person present.\n2. Record statement verbatim in their language.\n3. Read back statement and obtain signature/thumb impression.\n4. Attach to case file.'
        : defKey === 'ghatnasthal'
          ? '1. Cordon off the scene before entry.\n2. Sketch the scene and mark evidence locations.\n3. Photograph/video each piece of evidence in situ.\n4. Collect and seal evidence with labels.\n5. Prepare Panchnama with two independent witnesses.'
          : defKey === 'videography'
            ? '1. Verify e-Sakshya app is updated and device has sufficient battery.\n2. Record continuous video — do not stop/restart unnecessarily.\n3. Narrate visible actions for the record.\n4. Upload within 48 hours to the portal.'
            : '1. Prepare required materials and documentation.\n2. Execute the procedure per prescribed format.\n3. Record outcome and file with the case diary.',
    },
    {
      title: 'Related Documents & Evidence',
      body: 'Case diary entry, FIR copy, signed statements (if applicable), scene inspection report (if applicable), Panchnama (if applicable).',
    },
    {
      title: 'Best Practices',
      body: '• Maintain chronological documentation in the case diary.\n• Ensure all witnesses/participants are properly identified.\n• Cross-reference this step with related karyvahi entries.\n• Preserve the chain of custody for all evidence collected.',
    },
    {
      title: 'Common Mistakes to Avoid',
      body: '• Delayed execution after the event.\n• Incomplete or non-contemporaneous documentation.\n• Missing witness signatures on statements.\n• Failing to record this step in the Case Diary.',
    },
  ];
}

const PHASE_LABELS: Record<string, string> = {
  IMMEDIATE: 'तत्काल',
  INVESTIGATION: 'विवेचना',
  CLOSURE: 'समापन',
};

export function resolveKnowledgeSections(
  name: string,
  precautions?: string,
  playbookItem?: ChecklistItem | null,
  t?: (key: any, defaultValue?: any) => any,
  lang?: string
): KnowledgeSection[] {
  const currentLang = (lang || i18n?.language || 'hi').toLowerCase();
  const isEn = currentLang.startsWith('en');

  const defKey = matchDefaultKaryvahi(name);
  if (defKey) {
    const defKnowledge = getDefaultKnowledge(defKey, currentLang);
    if (defKnowledge) {
      const getTitle = (key: string, hiDefault: string, enDefault: string) => {
        if (t) {
          return t(`fir.karyvahiDetail.defaultKnowledge.${key}`, isEn ? enDefault : hiDefault);
        }
        return isEn ? enDefault : hiDefault;
      };

      const rawSections: Array<{ key: string; hiDefault: string; enDefault: string; body: string }> = [
        { key: 'what',  hiDefault: 'क्या करना है',     enDefault: 'What to do',             body: defKnowledge.what },
        { key: 'when',  hiDefault: 'कब करें',         enDefault: 'When to perform',        body: defKnowledge.when },
        { key: 'why',   hiDefault: 'क्यों आवश्यक',     enDefault: 'Why required',           body: defKnowledge.why },
        { key: 'legal', hiDefault: 'कानूनी महत्व',     enDefault: 'Legal importance',       body: defKnowledge.legal },
        { key: 'steps', hiDefault: 'जाँच के चरण',     enDefault: 'Investigation steps',    body: defKnowledge.steps },
        { key: 'docs',  hiDefault: 'संबंधित दस्तावेज़', enDefault: 'Related documents',      body: defKnowledge.docs },
        { key: 'care',  hiDefault: 'सर्वोत्तम व्यवहार', enDefault: 'Best practices',         body: defKnowledge.care },
        { key: 'risk',  hiDefault: 'सामान्य गलतियाँ',   enDefault: 'Common mistakes',        body: defKnowledge.risk },
      ];

      return rawSections
        .filter((s) => s.body && s.body.trim() !== '' && s.body.trim() !== '-')
        .map((s) => ({
          title: getTitle(s.key, s.hiDefault, s.enDefault),
          body: s.body.trim(),
        }));
    }
  }

  const defaults = deriveKnowledgeSections(name, precautions);
  if (!playbookItem) return defaults;

  const defMap = new Map<string, string>(defaults.map((s) => [s.title, s.body]));

  // 1. Why This Step Is Required <- why_text
  const whyBody = playbookItem.why_text?.trim() || defMap.get('Why This Step Is Required') || '';

  // 2. When to Perform <- phase label (IMMEDIATE=तत्काल, INVESTIGATION=विवेचना, CLOSURE=समापन) + condition_note when not empty
  const phaseKey = (playbookItem.phase ?? '').toUpperCase().trim();
  const phaseLabel = PHASE_LABELS[phaseKey] || playbookItem.phase?.trim() || '';
  const conditionNote = playbookItem.condition_note?.trim() || '';
  let whenBody = '';
  if (phaseLabel && conditionNote) {
    whenBody = `${phaseLabel} — ${conditionNote}`;
  } else if (phaseLabel) {
    whenBody = phaseLabel;
  } else if (conditionNote) {
    whenBody = conditionNote;
  }
  if (!whenBody) {
    whenBody = defMap.get('When to Perform') || '';
  }

  // 3. Legal Importance <- court_text, then a new line "आधार: <legal_basis>" when legal_basis is not empty
  const courtText = playbookItem.court_text?.trim() || '';
  const legalBasis = playbookItem.legal_basis?.trim() || '';
  let legalBody = '';
  if (courtText && legalBasis) {
    legalBody = `${courtText}\nआधार: ${legalBasis}`;
  } else if (courtText) {
    legalBody = courtText;
  } else if (legalBasis) {
    legalBody = `आधार: ${legalBasis}`;
  }
  if (!legalBody) {
    legalBody = defMap.get('Legal Importance') || '';
  }

  // 4. Investigation Steps
  const stepsBody =
    playbookItem.steps_text?.trim() ||
    defMap.get('Investigation Steps') ||
    '';

  // 5. Related Documents & Evidence
  const docsBody =
    playbookItem.docs_text?.trim() ||
    defMap.get('Related Documents & Evidence') ||
    '';

  // 6. Best Practices <- care_text
  const careBody = playbookItem.care_text?.trim() || defMap.get('Best Practices') || '';

  // 7. Common Mistakes to Avoid <- risk_text
  const riskBody = playbookItem.risk_text?.trim() || defMap.get('Common Mistakes to Avoid') || '';

  return [
    { title: 'Why This Step Is Required', body: whyBody },
    { title: 'When to Perform', body: whenBody },
    { title: 'Legal Importance', body: legalBody },
    { title: 'Investigation Steps', body: stepsBody },
    { title: 'Related Documents & Evidence', body: docsBody },
    { title: 'Best Practices', body: careBody },
    { title: 'Common Mistakes to Avoid', body: riskBody },
  ];
}
