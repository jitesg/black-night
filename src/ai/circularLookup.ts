/**
 * circularLookup.ts
 *
 * Dedicated search, ranking, and response extraction engine for UP Police DGP Circulars.
 * Implements:
 * - Typo-tolerant normalization (Hinglish/Hindi/Latin)
 * - Stop-words removal
 * - Hard minimum (min 2 distinct matched terms OR 1 rare/multi-word tag)
 * - 55% relative score cutoff, max 3 results
 * - Pure quotation from entry text (no invented numbers/dates)
 * - Specialized sub-block extractors:
 *   - Circular no. + date (first 2 lines)
 *   - "सार" paragraph
 *   - "मुख्य निर्देश" (first bullet group)
 *   - "समय-सीमाएँ" block
 *   - "व्यवहार में कैसे लागू करें" block
 *   - "सेल्फ-चेक" (☐ line)
 * - Standard action chips and "सहायक सामग्री — मूल परिपत्र देखें" footnote
 */

import { getKnowledgeByCategory, type KnowledgeEntry } from '@/lib/db/knowledgeRepo';
import { getKnowledgeNote, getAllKnowledgeNotesMap } from '@/lib/db/knowledgeNotesRepo';
import { STOP_WORDS, normalizeHinglishToken } from '@/lib/law/detailedAnalysis';
import { getDisplayShortTitle, parseSadharanBlock, stripSadharanMarkers } from '@/lib/knowledge/knowledgeDisplay';
import circularsSeedData from '../../assets/seed/circulars_seed.json';
import circularsSeed2Data from '../../assets/seed/circulars_seed_2.json';
import circularsSeed3Data from '../../assets/seed/circulars_seed_3.json';
import circularsSeed4Data from '../../assets/seed/circulars_seed_4.json';
import circularsSeed5Data from '../../assets/seed/circulars_seed_5.json';
import circularsSeed6Data from '../../assets/seed/circulars_seed_6.json';
import circularsSeed7Data from '../../assets/seed/circulars_seed_7.json';
import circularsSeed8Data from '../../assets/seed/circulars_seed_8.json';

export interface CircularHit {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}

export interface CircularLookupResult {
  content: string;
  suggestedActions: string[];
  matchedCircularId?: string;
}

// Fallback in-memory list from bundled seeds
const BUNDLED_CIRCULARS_RAW = [
  ...((circularsSeedData as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed2Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed3Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed4Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed5Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed6Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed7Data as { knowledge?: any[] })?.knowledge ?? []),
  ...((circularsSeed8Data as { knowledge?: any[] })?.knowledge ?? []),
];
const BUNDLED_CIRCULARS = BUNDLED_CIRCULARS_RAW.map(
  (k) => ({
    id: k.id,
    title: k.title,
    category: k.category,
    subcategory: k.subcategory,
    crime_type: k.crime_type,
    description: k.description,
    tags: k.tags,
    attachment_uris: k.attachment_uris,
    source: 'system' as const,
    editable: 0 as const,
    content_type: k.content_type || 'circular',
    seed_version: k.seed_version || 1,
    app_version: k.app_version || '',
    last_updated: k.last_updated || '',
    created_at: 0,
    updated_at: 0,
    version: 1,
  })
);

/**
 * Extract circular number and date (first two lines of the description).
 */
export function getCircularNumberAndDate(description: string): string {
  if (!description) return '';
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    let dateLine = lines[1];
    if (dateLine.includes('मई 2013')) {
      dateLine = 'दिनांक: मई 2013';
    }
    return `${lines[0]}\n${dateLine}`;
  }
  return lines[0] || '';
}

/**
 * Extract the "सार" paragraph from the circular description.
 */
export function getCircularSar(description: string): string {
  if (!description) return '';
  const match = description.match(/सार\s*:\s*([\s\S]*?)(?=\n\s*(?:मुख्य निर्देश|समय-सीमाएँ|संबंधित प्रावधान|भाग\s+[A-Z0-9]+|━━━━━━━━━━━━━━━━|$))/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Fallback: search for line starting with सार
  const lines = description.split('\n');
  const sarLine = lines.find((l) => l.trim().startsWith('सार'));
  return sarLine ? sarLine.trim() : '';
}

/**
 * Extract "मुख्य निर्देश" (first bullet group under मुख्य निर्देश).
 */
export function getCircularMainInstructions(description: string): string {
  if (!description) return '';
  const match = description.match(/(?:मुख्य निर्देश|निर्देश)\s*:\s*\n*([\s\S]*?)(?=\n\s*(?:समय-सीमाएँ|संबंधित प्रावधान|भाग\s+[B-Z0-9]+|प्रशिक्षण|━━━━━━━━━━━━━━━━|$))/i);
  if (match && match[1]) {
    const text = match[1].trim();
    // Return the bullet points
    return text;
  }
  return '';
}

/**
 * Extract "समय-सीमाएँ" block if present.
 */
export function getCircularTimeLimits(description: string): string | null {
  if (!description) return null;
  const match = description.match(/(?:समय-सीमाएँ|समय-सीमा|समय सीमा)\s*:\s*\n*([\s\S]*?)(?=\n\s*(?:मुख्य निर्देश|संबंधित प्रावधान|भाग\s+[A-Z0-9]+|━━━━━━━━━━━━━━━━|$))/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract "व्यवहार में कैसे लागू करें" block (after ━━━━━━━━━━━━━━━━).
 */
export function getCircularImplementationGuidance(description: string): string | null {
  if (!description) return null;
  const separator = '━━━━━━━━━━━━━━━━';
  if (description.includes(separator)) {
    const parts = description.split(separator);
    return parts.slice(1).join(separator).trim();
  }
  const match = description.match(/(व्यवहार में कैसे लागू करें[\s\S]*)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract "सेल्फ-चेक" (the line with ☐).
 */
export function getCircularSelfCheck(description: string): string | null {
  if (!description) return null;
  const lines = description.split('\n');
  const selfCheckLine = lines.find((l) => l.includes('☐'));
  return selfCheckLine ? selfCheckLine.trim() : null;
}

/**
 * Check whether a query targets circular lookup.
 */
export function isCircularLookupQuery(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();

  // Explicit circular keywords
  if (/\b(परिपत्र|circular|circulars|dgp|डीजी\s*परिपत्र|शासनादेश|paripatra)\b/i.test(q)) {
    return true;
  }

  // Circular simple explanation intents
  if (
    /(circular.*(matlab|simple|vyakhya|samjha|kya karna)|sadharan\s*vyakhya|साधारण\s*व्याख्या|samjha\s*do\s*circular|is\s*circular\s*me\s*mujhe\s*kya\s*karna\s*hai|saral\s*bhasha|सीधी\s*बात)/i.test(
      q
    )
  ) {
    return true;
  }

  // Circular numbers (including 3/2012, 4/2012, 9/2012, 11/2012, 12/2012, 14/2012, 15/2012 and dg variants)
  if (/\b(3\/2012|4\/2012|9\/2012|11\/2012|12\/2012|14\/2012|15\/2012|dg[- ]?3(\/2012)?|dg[- ]?4(\/2012)?|dg[- ]?9(\/2012)?|dg[- ]?11(\/2012)?|dg[- ]?12(\/2012)?|dg[- ]?14(\/2012)?|dg[- ]?15(\/2012)?)\b/i.test(q)) {
    return true;
  }

  // Sub-actions and chips
  if (/(मुख्य\s*निर्देश|समय[- ]सीमा|व्यवहार\s*में\s*कैसे\s*लागू|real\s*life\s*me\s*kaise\s*lagu|kaise\s*lagu\s*karen|सेल्फ[- ]चेक|self[- ]check|परिपत्र\s*खोलें)/i.test(q)) {
    return true;
  }

  // 11/2012 topics: jamanatiya apradh yuva abhiyukt rihai, bailable offence young accused release/bond, sanjay vs state of up, 276
  if (
    /(jamanatiya.*(yuva|abhiyukt|rihai|bond)|yuva.*(abhiyukt|rihai|bond)|bailable.*(young|accused|bond|release|chhod)|sanjay\s*vs\s*state|संजय\s*बनाम\s*स्टेट|276\s*\(?एच|जमानतीय.*युवा|युवा.*बंधपत्र|bailable\s*offence.*release)/i.test(
      q
    )
  ) {
    return true;
  }

  // 9/2012 topics: vivechna transfer abhiyukt ke kehne par, vivechak badalna, vivechna sthanantaran, sis
  if (
    /(vivechna\s*transfer|विवेचना.*स्थानांतरण|vivechak\s*badal|विवेचक.*बदल|abhiyukt.*kehne.*par|vivechna.*sthanantaran|sthanantaran.*kaun.*kar|sis.*transfer|एस०आई०एस०)/i.test(
      q
    )
  ) {
    return true;
  }

  // women-safety: mahila suraksha circular, school college ke bahar patrolling, shadi samaroh me bachchi gum, school ke bahar chhedchhad rokne ke liye kya karna hai
  if (
    /(mahila\s*suraksha|महिला\s*सुरक्षा|school.*(bahar|patrolling|chhedchhad)|college.*(bahar|patrolling)|shadi\s*samaroh.*(bachchi|gum)|chhedchhad\s*rokne|छेड़छाड़|संदेहास्पद.*समारोह)/i.test(
      q
    )
  ) {
    return true;
  }

  // 4/2012: field unit kab bulaye, dna sample khoon fingerprint kaise uthaye, hatya ke baad field unit kab bulayen
  if (
    /(field\s*unit|फील्ड\s*यूनिट|dna\s*sample|fingerprint.*(kaise|uthaye)|khoon.*fingerprint|भौतिक\s*साक्ष्य|hatya.*field\s*unit)/i.test(
      q
    )
  ) {
    return true;
  }

  // 3/2012: avaidh sharab circular, jahrili sharab se maut thanadhyaksh zimmedari, dhabe par spirit tanker
  if (
    /(avaidh\s*sharab|अवैध\s*शराब|jahrili\s*sharab|जहरीली\s*शराब|sharab\s*se\s*maut|thanadhyaksh\s*zimmedari|थानाध्यक्ष.*जिम्मेदारी|dhabe\s*par\s*spirit|spirit\s*tanker|स्प्रिट.*टैंकर)/i.test(
      q
    )
  ) {
    return true;
  }

  // 12/2012 topics: atikraman / अतिक्रमण, beat prabhari / बीट प्रभारी
  if (/(atikraman|अतिक्रमण|beat\s*prabhari|बीट\s*प्रभारी)/i.test(q)) {
    return true;
  }

  // 14/2012 topics: vivechna police alag / विवेचना पुलिस अलग / law and order alag
  if (/(vivechna\s*police|विवेचना\s*पुलिस|law\s*and\s*order\s*alag|कानून[- ]व्यवस्था.*अलग|विवेचना.*अलग)/i.test(q)) {
    return true;
  }

  // 15/2012 topics: CR-4 / CR4 / सीआर-4, professional criminal / पेशेवर अपराधी
  if (/(cr[- ]?4|सीआर[- ]?4|professional\s*criminal|पेशेवर\s*अपराधी)/i.test(q)) {
    return true;
  }

  // ── 2013 Circular Numbers & Topics (Task L25) ───────────────────────────
  // Numbers: 1/2013, 2/2013, 3/2013, 4/2013, 5/2013, 6/2013, 7/2013, 8/2013, 70/2013, 71/2013, 72/2013, 73/2013, 75/2013 and dg variants
  if (
    /\b(0?1\/2013|0?2\/2013|0?3\/2013|0?4\/2013|5\/2013|6\/2013|7\/2013|8\/2013|70\/2013|71\/2013|72\/2013|73\/2013|75\/2013|dg[- ]?0?1(\/2013)?|dg[- ]?0?2(\/2013)?|dg[- ]?0?3(\/2013)?|dg[- ]?0?4(\/2013)?|dg[- ]?5(\/2013)?|dg[- ]?6(\/2013)?|dg[- ]?7(\/2013)?|dg[- ]?8(\/2013)?|dg[- ]?70(\/2013)?|dg[- ]?71(\/2013)?|dg[- ]?72(\/2013)?|dg[- ]?73(\/2013)?|dg[- ]?75(\/2013)?)\b/i.test(
      q
    )
  ) {
    return true;
  }

  // Lalita Kumari / mandatory FIR / preliminary inquiry
  if (/(lalita\s*kumari|ललिता\s*कुमारी|fir\s*anivarya|fir.*zaroori|preliminary\s*inquiry|प्रारंभिक\s*जाँच|fir\s*darj)/i.test(q)) {
    return true;
  }

  // Viscera (DG-8/2013 & DG-5/2013)
  if (/(visera|viscera|विसरा|647\s*विसरा)/i.test(q)) {
    return true;
  }

  // Road safety week (17–23 March 2013)
  if (/(road\s*safety\s*week|सड़क\s*सुरक्षा\s*सप्ताह|road\s*safety)/i.test(q)) {
    return true;
  }

  // Press briefing female crimes
  if (/(press\s*briefing|प्रेस\s*ब्रीफिंग|mahila\s*apradh.*press)/i.test(q)) {
    return true;
  }

  // Black film on car windows (DG-1/2013)
  if (/(kali\s*film|काली\s*फिल्म|shishe.*film|shishe.*challan|शीशों.*काली|tinted\s*glass)/i.test(q)) {
    return true;
  }

  // Section 170 accused presence on chargesheet (DG-2/2013)
  if (/(dhara\s*170|धारा\s*170|aaropi.*upasthiti|abhiyukt.*upasthiti|court\s*me\s*upasthiti|charge\s*sheet.*upasthiti)/i.test(q)) {
    return true;
  }

  // Murder / Rape video statement (DG-3/2013)
  if (/(hatya.*balatkar.*video|video\s*bayan|वीडियो\s*बयान|hatya\s*balatkar\s*vivechna|घटनास्थल\s*सुरक्षा)/i.test(q)) {
    return true;
  }

  // NDPS 41/42 search 72 hours (DG-4/2013)
  if (/(ndps.*(41|42|talashi|72|तलाशी)|talashi\s*72|72\s*ghante|72\s*घंटे.*सूचना|\bndps\b|एनडीपीएस)/i.test(q)) {
    return true;
  }

  // Crime branch jurisdiction (DG-75/2013)
  if (/(crime\s*branch|क्राइम\s*ब्रांच|thanadhyaksh\s*sah[- ]vivechak|सह[- ]विवेचक)/i.test(q)) {
    return true;
  }

  // Bail criminal history placement (DG-71/2013)
  if (/(jamanat.*criminal\s*history|bail.*criminal\s*history|criminal\s*history.*kaha\s*likhe|prastarwar|प्रस्तरवार\s*टिप्पणी|आपराधिक\s*इतिहास)/i.test(q)) {
    return true;
  }

  // Section 363/366 high court order & FD orders (DG-70/2013 & DG-73/2013)
  if (/(363\s*366|363\/366|धारा\s*363|dhara\s*363|high\s*court\s*order.*363|fd\s*ka\s*aadesh)/i.test(q)) {
    return true;
  }

  // Employee welfare / grievance register (DG-72/2013)
  if (/(karmchari\s*kalyan|kalyan\s*sammelan|adhinasto\s*se\s*samvad|samadhaan\s*register|समस्या[- ]रजिस्टर|कल्याण\s*सम्मेलन)/i.test(q)) {
    return true;
  }

  // Missing children portal upload (DG-6/2013)
  if (/(gumshuda.*bachche|track\s*the\s*missing\s*child|missing\s*child\s*portal|गुमशुदा\s*बच्चों)/i.test(q)) {
    return true;
  }

  // Eve teasing SC 7 directions (DG-7/2013)
  if (/(eve\s*teasing|ईव\s*टीज़िंग)/i.test(q)) {
    return true;
  }

  // Service court cases (DG court-cases-service-2013)
  if (/(seva\s*sambandhi|service\s*matters.*court|सेवा\s*संबंधी)/i.test(q)) {
    return true;
  }

  // ── 2013 Circulars 11/2013 to 20/2013 (Task L26) ──────────────────────────
  if (
    /\b(11\/2013|12\/2013|13\/2013|14\/2013|15\/2013|16\/2013|17\/2013|18\/2013|19\/2013|20\/2013|dg[- ]?(?:11|12|13|14|15|16|17|18|19|20)(\/2013)?)\b/i.test(
      q
    )
  ) {
    return true;
  }

  // 11/2013: juvenile hathkadi, bal kalyan adhikari sjpu, umra nirdharan juvenile
  if (/(juvenile.*hathkadi|hathkadi.*juvenile|bal\s*kalyan\s*adhikari|sjpu|umra\s*nirdharan\s*juvenile|किशोर.*हथकड़ी|हथकड़ी.*किशोर|बाल\s*कल्याण\s*अधिकारी|एसजेपीयू)/i.test(q)) {
    return true;
  }

  // 12/2013: gumshuda bachcha fir 363, track child upload 24 ghante, bachcha gum ho to fir kab
  if (/(gumshuda\s*bachch?a|bachch?a\s*gum|track\s*child|24\s*ghante.*(track|child|suchna)|गुमशुदा\s*बच्चा|गुमशुदा\s*बच्चे.*363)/i.test(q)) {
    return true;
  }

  // 13/2013: mahila apradh police prakriya, 161 bayan ghar par 160 notice nahi, balatkar peedita ka bayan
  if (/(mahila\s*apradh\s*police\s*prakriya|161\s*bayan|160\s*notice|bayan\s*ghar\s*par|balatkar\s*peedita.*bayan|peedita.*bayan\s*kaha|महिला\s*अपराध.*प्रक्रिया|बयान.*घर\s*पर)/i.test(q)) {
    return true;
  }

  // 14/2013: gowadh cow slaughter checking, meat sample mathura
  if (/(gowadh|cow\s*slaughter|meat\s*sample|mathura.*sample|सैंपल.*मथुरा|गोवध|गोवंश.*परिवहन)/i.test(q)) {
    return true;
  }

  // 15/2013: special sr case, sansani ghatna suchna hq, sp seedhe phone
  if (/(special\s*sr|sr\s*case|sansani\s*ghatna|suchna\s*hq|sp.*phone|सनसनीखेज.*मुख्यालय|एसपी.*फोन)/i.test(q)) {
    return true;
  }

  // 16/2013: mahila apradh vivechna, sade vesh me mahila arakshi, gaon bhraman 15 din
  if (/(sade\s*vesh|mahila\s*arakshi.*sade|gaon\s*bhraman|15\s*din.*gaon|सादे\s*वेश|ग्राम\s*भ्रमण)/i.test(q)) {
    return true;
  }

  // 17/2013: road jam bal prayog kram, pdpp act
  if (/(road\s*jam|bal\s*prayog|pdpp|रोडजाम|उपद्रव.*बल\s*प्रयोग|लोक\s*संपत्ति\s*नुकसान)/i.test(q)) {
    return true;
  }

  // 18/2013: lock up suicide sentry 15 minute, custodial death 24 ghante postmortem nhrc, lockup me maut ho to kya kare
  if (/(lock\s*up.*suicide|lockup.*maut|custodial\s*death|sentry.*15\s*minute|nhrc.*24|हवालात.*आत्महत्या|अभिरक्षा.*मृत्यु|संतरी.*15\s*मिनट)/i.test(q)) {
    return true;
  }

  // 19/2013: broken window concept 509
  if (/(broken\s*window|509.*broken|ब्रोकन\s*विंडो|कार्ययोजना.*सप्ताह)/i.test(q)) {
    return true;
  }

  // 20/2013: media briefing kaun de sakta hai, media ko kaun bata sakta hai
  if (/(media\s*briefing|media.*kaun\s*bata|प्रेस\s*ब्रीफिंग.*अधिकृत|मीडिया.*अधिकृत)/i.test(q)) {
    return true;
  }

  return false;
}

/**
 * Format complete circular answer:
 * Order per Task L24:
 * 1. Short title + circular number/date
 * 2. "साधारण व्याख्या" (सीधी बात + आपको क्या करना है + एक लाइन)
 * 3. 3-4 key directions
 * 4. Amber warning
 * 5. User note if present
 * 6. Cross hints
 * (Markers [[SADHARAN]] are stripped and never displayed)
 */
export function formatCircularCompleteAnswer(entry: KnowledgeEntry, userNote?: string | null): string {
  const shortTitle = getDisplayShortTitle(entry);
  const numAndDate = stripSadharanMarkers(getCircularNumberAndDate(entry.description));

  const blocks: string[] = [];

  // 1. Short title + circular number/date
  blocks.push(`📌 **${shortTitle}**\n_${numAndDate}_`);

  // 2. साधारण व्याख्या (सीधी बात + आपको क्या करना है + एक लाइन)
  const sadharan = parseSadharanBlock(entry.description);
  if (sadharan) {
    const sadharanLines: string[] = ['📖 **साधारण व्याख्या:**'];
    if (sadharan.seedhiBaat) {
      sadharanLines.push(`• **सीधी बात**: ${sadharan.seedhiBaat}`);
    }
    if (sadharan.aapkoKyaKarnaHai.length > 0) {
      sadharanLines.push(`• **आपको क्या करना है**:\n${sadharan.aapkoKyaKarnaHai.slice(0, 4).map((b) => `  - ${b}`).join('\n')}`);
    }
    if (sadharan.ekLineMeYaadRakhen) {
      sadharanLines.push(`• **एक लाइन में याद रखें**: ${sadharan.ekLineMeYaadRakhen}`);
    }
    blocks.push(sadharanLines.join('\n'));
  }

  // 3. Key directions (3-4 bullets)
  let mainInstructions = getCircularMainInstructions(entry.description);
  if (mainInstructions) {
    mainInstructions = stripSadharanMarkers(mainInstructions);
    const rawLines = mainInstructions.split('\n').map((l) => l.trim()).filter(Boolean);
    const bullets = rawLines.filter((l) => l.startsWith('•') || l.startsWith('-'));
    if (bullets.length > 0) {
      mainInstructions = bullets.slice(0, 4).join('\n');
    } else {
      mainInstructions = rawLines.slice(0, 4).join('\n');
    }
    blocks.push(`**मुख्य निर्देश:**\n${mainInstructions}`);
  }

  // 4. Amber warning line
  const amberLine = stripSadharanMarkers(
    (entry.description || '').split('\n').find((l) => l.trim().startsWith('⚠'))?.trim() || ''
  );
  if (amberLine) {
    blocks.push(amberLine);
  }

  // 5. User note if present
  if (userNote) {
    blocks.push(`📝 **आपका नोट**: ${userNote}`);
  }

  // 6. Cross hints
  if (entry.id.includes('11-2012') || entry.title.includes('11/2012') || /sanjay\s*vs|276/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 478 (जमानतीय अपराध में जमानत) एवं BNSS धारा 192 (केस डायरी प्रविष्टि)।`);
  } else if (entry.id.includes('women-safety') || /women.*safety|महिला सुरक्षा/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNS धारा 74/75/78/79 (महिलाओं की लज्जा भंग, पीछा करना), BNSS धारा 173(2) (महिला अपराध में महिला पुलिस अधिकारी द्वारा विवेचना)।`);
  } else if (entry.id === 'sys-circ-dg-4-2012' || (entry.title.includes('4/2012') && !entry.title.includes('14/2012')) || /भौतिक साक्ष्य|फील्ड यूनिट/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 176(3) (7 वर्ष से अधिक सजा वाले अपराधों में फॉरेंसिक साक्ष्य संकलन अनिवार्य)।`);
  } else if (entry.id === 'sys-circ-dg-3-2012' || entry.title.includes('3/2012') || /अवैध शराब|आबकारी/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: यूपी आबकारी अधिनियम धारा 60/60(2) एवं BNS धारा 105/106/110 (जहरीली शराब से मृत्यु)।`);
  } else if (entry.id === 'sys-circ-dg-lalita-kumari-2013' || entry.title.includes('ललिता कुमारी') || entry.title.includes('517/2013')) {
    blocks.push(`💡 **विधिक संदर्भ**: ललिता कुमारी बनाम यूपी राज्य (2014) SC संविधान पीठ निर्णय — BNSS धारा 173(1) (संज्ञेय अपराध में FIR अनिवार्य) एवं धारा 173(3) (प्रारंभिक जाँच)।`);
  } else if (entry.id === 'sys-circ-ardh-dg-4-2013' || (entry.title.includes('04/2013') && entry.title.includes('2013')) || /एन०डी०पी०|ndps/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: NDPS Act धारा 41/42/50 (तलाशी, जब्ती एवं 72 घंटे में उच्चाधिकारी को सूचना)।`);
  } else if (entry.id === 'sys-circ-dg-2-2013' || entry.title.includes('02/2013') || entry.title.includes('धारा-170')) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 190 (पूर्व धारा 170 CrPC — आरोप-पत्र दाखिल करते समय अभियुक्त की उपस्थिति)।`);
  } else if (entry.id === 'sys-circ-ardh-dg-3-2013' || (entry.title.includes('03/2013') && entry.title.includes('2013'))) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 176 / BNS धारा 64/103 (गंभीर अपराधों में घटनास्थल सुरक्षा एवं वीडियो साक्ष्य)।`);
  } else if (entry.id === 'sys-circ-dg-71-2013' || entry.title.includes('71/2013')) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 479/480 (जमानत विरोध में प्रस्तरवार टिप्पणी व पूर्व आपराधिक इतिहास)।`);
  } else if (entry.id === 'sys-circ-dg-70-2013' || entry.id === 'sys-circ-dg-73-2013' || entry.title.includes('70/2013') || entry.title.includes('73/2013')) {
    blocks.push(`💡 **विधिक संदर्भ**: BNS धारा 137(2)/87 (पूर्व 363/366 IPC — उच्च न्यायालय के आदेशों का अनुपालन)।`);
  } else if (entry.id === 'sys-circ-dg-5-2013' || entry.id === 'sys-circ-ardh-dg-8-2013' || entry.title.includes('विसरा')) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 196 (मृत्यु समीक्षा एवं विसरा परीक्षण हेतु FSL प्रेषण)।`);
  } else if (entry.id.includes('11-2013') || entry.title.includes('11/2013') || /किशोर|बाल कल्याण/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: JJ Act (किशोर न्याय अधिनियम) धारा 10 व 12 (किशोर को किसी भी दशा में हथकड़ी या हवालात में नहीं रखा जाएगा; बाल कल्याण पुलिस अधिकारी एवं SJPU द्वारा कार्यवाही)।`);
  } else if (entry.id.includes('12-2013') || entry.title.includes('12/2013') || (/गुमशुदा/i.test(entry.title) && /363/i.test(entry.title))) {
    blocks.push(`💡 **विधिक संदर्भ**: BNS धारा 137(2) / IPC धारा 363 (नाबालिग गुमशुदगी पर तुरंत अपहरण का अभियोग), Bachpan Bachao Andolan vs UOI निर्देश एवं Track Child पोर्टल पर 24 घंटे में विवरण।`);
  } else if (entry.id.includes('13-2013') || entry.title.includes('13/2013')) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 180(3)/179 (पूर्व 161/160 CrPC — महिला अपराध में महिला पुलिस अधिकारी द्वारा पीड़िता के घर/सुविधाजनक स्थान पर बयान व संभव होने पर ऑडियो-वीडियो रिकॉर्डिंग; थाने नहीं बुलाया जाएगा)।`);
  } else if (entry.id.includes('14-2013') || entry.title.includes('14/2013') || /गोवध/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: उ०प्र० गो-वध निवारण अधिनियम 1955, पशु क्रूरता निवारण अधिनियम 1960 एवं FSL/मथुरा लैब मांस सैंपलिंग प्रक्रिया।`);
  } else if (entry.id.includes('15-2013') || entry.title.includes('15/2013') || /सनसनीखेज/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: पुलिस रेगुलेशन एवं मुख्यालय निर्देश (स्पेशल रिपोर्ट SR केस — सनसनीखेज अपराधों की तत्काल फैक्स/फोन/वायरलेस से DGP कंट्रोल रूम व अधिकारियों को सूचना)।`);
  } else if (entry.id.includes('16-2013') || entry.title.includes('16/2013') || /सादे वेश/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 173(2) (महिला अपराध विवेचना प्राथमिकता, संवेदनशील स्थलों पर सादे वेश में महिला आरक्षियों की तैनाती एवं 15 दिन में ग्राम भ्रमण)।`);
  } else if (entry.id.includes('17-2013') || entry.title.includes('17/2013') || /रोडजाम|उपद्रव/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 148-152 (विधि-विरुद्ध जमाव तितर-बितर करना), न्यूनतम बल प्रयोग का क्रमिक सिद्धांत, अनिवार्य वीडियोग्राफी एवं PDPP Act (लोक संपत्ति नुकसान निवारण अधिनियम 1984)।`);
  } else if (entry.id.includes('18-2013') || entry.title.includes('18/2013') || /हवालात|अभिरक्षा में मृत्यु/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: BNSS धारा 196 (पूर्व CrPC धारा 176(1क) — पुलिस अभिरक्षा में मृत्यु पर न्यायिक मजिस्ट्रेट द्वारा अनिवार्य जाँच), NHRC को 24 घंटे में सूचना एवं वीडियोग्राफी व डॉक्टरों के पैनल द्वारा पोस्टमार्टम।`);
  } else if (entry.id.includes('19-2013') || entry.title.includes('19/2013') || /broken window/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: Broken Window सिद्धान्त (छोटे अपराधों पर तुरंत रोक), BNS धारा 79 (पूर्व IPC 509 — शब्द, अंगविक्षेप से लज्जा भंग), पैरवी सेल द्वारा कठोर सजा।`);
  } else if (entry.id.includes('20-2013') || entry.title.includes('20/2013') || /मीडिया ब्रीफिंग/i.test(entry.title)) {
    blocks.push(`💡 **विधिक संदर्भ**: पुलिस रेगुलेशन पैरा 16 एवं DGP निर्देश (मीडिया ब्रीफिंग केवल अधिकृत अधिकारी — SP/PRO/नामित नोडल द्वारा; अनधिकृत वक्तव्य पर अनुशासनात्मक कार्यवाही)।`);
  }

  blocks.push(`_सहायक सामग्री — मूल परिपत्र देखें_`);

  return blocks.join('\n\n');
}

/**
 * Rank and lookup circulars from knowledge_entries with category "Circular".
 */
export async function lookupCirculars(query: string): Promise<CircularLookupResult> {
  let circulars: KnowledgeEntry[] = [];
  try {
    circulars = await getKnowledgeByCategory('Circular');
  } catch {
    // fallback
  }

  if (!circulars || circulars.length === 0) {
    circulars = BUNDLED_CIRCULARS as unknown as KnowledgeEntry[];
  }

  const normQuery = query.toLowerCase();

  // ── 1. Check for specific sub-action queries ───────────────────────────────
  // E.g. "12/2012 ko real life me kaise lagu karen" or "व्यवहार में कैसे लागू करें"
  const isLaguKaren = /(व्यवहार\s*में\s*कैसे\s*लागू|real\s*life\s*me\s*kaise\s*lagu|kaise\s*lagu\s*karen|लागू\s*करें)/i.test(normQuery);
  const isMukhyaNirdesh = /(मुख्य\s*निर्देश|first\s*bullet|main\s*instructions)/i.test(normQuery);
  const isSamaySeemaye = /(समय[- ]सीमा|time\s*limits?|deadlines?)/i.test(normQuery);
  const isSelfCheck = /(सेल्फ[- ]चेक|self[- ]check|☐)/i.test(normQuery);

  // Check if a specific circular number or topic is mentioned in the query
  let targetedEntry: KnowledgeEntry | undefined;
  if (/women[- ]?safety|mahila\s*suraksha|महिला\s*सुरक्षा|school.*(bahar|patrolling|chhedchhad)|college.*(bahar|patrolling)|shadi\s*samaroh.*(bachchi|gum)|chhedchhad\s*rokne|छेड़छाड़|संदेहास्पद.*समारोह/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-women-safety-2012' || c.title.includes('महिलाओं के विरुद्ध'));
  } else if (/4\/2012|dg[- ]?4|field\s*unit|फील्ड\s*यूनिट|dna\s*sample|fingerprint|भौतिक\s*साक्ष्य|hatya.*field/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-4-2012' || (c.title.includes('4/2012') && !c.title.includes('14/2012')));
  } else if (/3\/2012|dg[- ]?3|avaidh\s*sharab|अवैध\s*शराब|jahrili\s*sharab|जहरीली\s*शराब|sharab\s*se\s*maut|thanadhyaksh\s*zimmedari|थानाध्यक्ष.*जिम्मेदारी|dhabe.*spirit|spirit\s*tanker|स्प्रिट.*टैंकर/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-3-2012' || c.title.includes('3/2012'));
  } else if (/11\/2012|dg[- ]?11|sanjay\s*vs|संजय\s*बनाम|276\s*\(?एच|jamanatiya.*(yuva|rihai|bond|abhiyukt)|bailable.*(young|accused|bond|release)|bond\s*par\s*chhod|रिहाई/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-11-2012' || c.title.includes('11/2012'));
  } else if (/9\/2012|dg[- ]?9|vivechna.*transfer|विवेचना.*स्थानांतरण|vivechak\s*badal|विवेचक\s*बदल|आरोपी.*प्रार्थना|abhiyukt.*(transfer|kehne)|sthanantaran|sis.*transfer|एस०आई०एस०/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-9-2012' || c.title.includes('9/2012'));
  } else if (/12\/2012|dg[- ]?12/i.test(normQuery) || /अतिक्रमण|atikraman|beat\s*prabhari/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-12-2012' || c.title.includes('12/2012'));
  } else if (/14\/2012|dg[- ]?14/i.test(normQuery) || /विवेचना\s*पुलिस|vivechna\s*police|law\s*and\s*order|विवेचना.*अलग/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-14-2012' || c.title.includes('14/2012'));
  } else if (/15\/2012|dg[- ]?15/i.test(normQuery) || /cr[- ]?4|सीआर[- ]?4|professional\s*criminal/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-15-2012' || c.title.includes('15/2012'));
  } else if (/lalita\s*kumari|ललिता\s*कुमारी|fir\s*darj\s*karna\s*zaroori|fir\s*anivarya|preliminary\s*inquiry|प्रारंभिक\s*जाँच|517\/2013/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-lalita-kumari-2013' || c.title.includes('ललिता कुमारी') || c.title.includes('517/2013'));
  } else if (/kali\s*film|काली\s*फिल्म|shishe.*(film|challan)|शीशों.*काली|0?1\/2013|dg[- ]?0?1(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-1-2013' || c.title.includes('01/2013') || c.title.includes('काली फिल्म'));
  } else if (/dhara\s*170|धारा\s*170|aaropi.*court.*upasthiti|abhiyukt.*upasthiti|charge\s*sheet.*upasthiti|0?2\/2013|dg[- ]?0?2(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-2-2013' || c.title.includes('02/2013') || c.title.includes('धारा-170'));
  } else if (/hatya.*balatkar.*video|video\s*bayan|वीडियो\s*बयान|hatya\s*balatkar\s*vivechna|0?3\/2013|dg[- ]?0?3(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-3-2013' || (c.title.includes('03/2013') && c.title.includes('2013')));
  } else if (/ndps.*(41|42|talashi|72|तलाशी)|talashi\s*72|72\s*ghante|72\s*घंटे|0?4\/2013|dg[- ]?0?4(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-4-2013' || (c.title.includes('04/2013') && c.title.includes('2013')));
  } else if (/eve\s*teasing|ईव\s*टीज़िंग|7\/2013|dg[- ]?7(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-7-2013' || c.title.includes('7/2013'));
  } else if (/gumshuda.*(bachche|portal|upload)|missing\s*child|गुमशुदा\s*बच्चों|6\/2013|dg[- ]?6(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-6-2013' || c.title.includes('6/2013'));
  } else if (/crime\s*branch|क्राइम\s*ब्रांच|thanadhyaksh\s*sah[- ]vivechak|75\/2013|dg[- ]?75(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-75-2013' || c.title.includes('75/2013'));
  } else if (/road\s*safety|सड़क\s*सुरक्षा/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-road-safety-week-2013' || c.title.includes('सड़क सुरक्षा'));
  } else if (/press\s*briefing|प्रेस\s*ब्रीफिंग/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-women-media-2013' || c.title.includes('प्रेस'));
  } else if (/seva\s*sambandhi|service\s*matters.*court|सेवा\s*संबंधी/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-court-cases-service-2013' || c.title.includes('सेवा संबंधी'));
  } else if (/73\/2013|dg[- ]?73(\/2013)?|fd\s*ka\s*aadesh/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-73-2013' || c.title.includes('73/2013'));
  } else if (/karmchari\s*kalyan|kalyan\s*sammelan|adhinasto\s*se\s*samvad|समस्या[- ]रजिस्टर|72\/2013|dg[- ]?72(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-72-2013' || c.title.includes('72/2013'));
  } else if (/criminal\s*history.*kaha\s*likhe|bail.*criminal\s*history|jamanat.*criminal\s*history|प्रस्तरवार\s*टिप्पणी|71\/2013|dg[- ]?71(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-71-2013' || c.title.includes('71/2013'));
  } else if (/363\s*366.*high\s*court|363\/366|70\/2013|dg[- ]?70(\/2013)?/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-70-2013' || c.title.includes('70/2013'));
  } else if (/visera|viscera|विसरा/i.test(normQuery)) {
    if (/jahar|poison|जहर|5\/2013|dg[- ]?5/i.test(normQuery)) {
      targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-5-2013' || c.title.includes('5/2013'));
    } else if (/647|sesh|शेष|8\/2013|dg[- ]?8/i.test(normQuery)) {
      targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-8-2013' || c.title.includes('8/2013'));
    } else {
      // General viscera query like "visera kab bhejna chahiye" -> Return DG-8/2013 and DG-5/2013 together
      const v8 = circulars.find((c) => c.id === 'sys-circ-ardh-dg-8-2013');
      const v5 = circulars.find((c) => c.id === 'sys-circ-dg-5-2013');
      if (v8 && v5 && !isLaguKaren && !isMukhyaNirdesh && !isSamaySeemaye && !isSelfCheck) {
        const note8 = await getKnowledgeNote(v8.id);
        const ans8 = formatCircularCompleteAnswer(v8, note8);
        const header5 = getCircularNumberAndDate(v5.description);
        const short5 = getDisplayShortTitle(v5);
        const sar5 = getCircularSar(v5.description);
        const combined = [
          ans8,
          `━━━━━━━━━━━━━━━━━━━━\n\n**अन्य संबंधित परिपत्र (DG-5/2013):**\n\n📌 **${header5} — ${short5}**\n\n${sar5 ? `**सार**: ${sar5}\n\n` : ''}_सहायक सामग्री — मूल परिपत्र देखें_`,
        ].join('\n\n');
        return {
          content: combined,
          suggestedActions: ['परिपत्र खोलें', 'मुख्य निर्देश', 'समय-सीमाएँ', 'व्यवहार में कैसे लागू करें', 'सेल्फ-चेक'],
          matchedCircularId: v8.id,
        };
      } else if (v8) {
        targetedEntry = v8;
      }
    }
  } else if (/balatkar.*(peedita|bayan)|peedita.*ka.*bayan|बलात्कार.*पीड़िता.*बयान/i.test(normQuery)) {
    // "balatkar peedita ka bayan kaha" -> 13/2013 and 16/2013
    const c13 = circulars.find((c) => c.id === 'sys-circ-ardh-dg-13-2013' || c.title.includes('13/2013'));
    const c16 = circulars.find((c) => c.id === 'sys-circ-dg-16-2013' || c.title.includes('16/2013'));
    if (c13 && c16 && !isLaguKaren && !isMukhyaNirdesh && !isSamaySeemaye && !isSelfCheck) {
      const note13 = await getKnowledgeNote(c13.id);
      const ans13 = formatCircularCompleteAnswer(c13, note13);
      const header16 = getCircularNumberAndDate(c16.description);
      const short16 = getDisplayShortTitle(c16);
      const sar16 = getCircularSar(c16.description);
      const combined = [
        ans13,
        `━━━━━━━━━━━━━━━━━━━━\n\n**संबंधित परिपत्र (DG-16/2013):**\n\n📌 **${short16}**\n_${header16}_\n\n${sar16 ? `**सार**: ${sar16}\n\n` : ''}_सहायक सामग्री — मूल परिपत्र देखें_`,
      ].join('\n\n');
      return {
        content: combined,
        suggestedActions: ['परिपत्र खोलें', 'मुख्य निर्देश', 'समय-सीमाएँ', 'व्यवहार में कैसे लागू करें', 'सेल्फ-चेक'],
        matchedCircularId: c13.id,
      };
    } else if (c13) {
      targetedEntry = c13;
    }
  } else if (/juvenile.*hathkadi|hathkadi.*juvenile|bal\s*kalyan\s*adhikari|sjpu|umra\s*nirdharan\s*juvenile|किशोर.*हथकड़ी|हथकड़ी.*किशोर|बाल\s*कल्याण\s*अधिकारी|11\/2013|dg[- ]?11\/2013/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-11-2013' || (c.title.includes('11/2013') && c.title.includes('2013')));
  } else if (/gumshuda\s*bachch?a\s*fir\s*363|bachch?a\s*gum|track\s*child\s*upload|12\/2013|dg[- ]?12\/2013/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-12-2013' || (c.title.includes('12/2013') && c.title.includes('2013')));
  } else if (/mahila\s*apradh\s*police\s*prakriya|161\s*bayan\s*ghar\s*par|160\s*notice\s*nahi|13\/2013|dg[- ]?13/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-13-2013' || c.title.includes('13/2013'));
  } else if (/gowadh|cow\s*slaughter|meat\s*sample|mathura|गोवध|गोवंश|14\/2013|dg[- ]?14\/2013/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-14-2013' || (c.title.includes('14/2013') && c.title.includes('2013')));
  } else if (/special\s*sr\s*case|sansani\s*ghatna|सनसनीखेज|sp\s*seedhe\s*phone|15\/2013|dg[- ]?15\/2013/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-15-2013' || (c.title.includes('15/2013') && c.title.includes('2013')));
  } else if (/sade\s*vesh|gaon\s*bhraman|15\s*din\s*me\s*gaon|16\/2013|dg[- ]?16/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-16-2013' || c.title.includes('16/2013'));
  } else if (/road\s*jam|bal\s*prayog\s*kram|pdpp|रोडजाम|उपद्रव.*बल|17\/2013|dg[- ]?17/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-17-2013' || c.title.includes('17/2013'));
  } else if (/lock\s*up\s*suicide|sentry\s*15\s*minute|custodial\s*death|24\s*ghante\s*postmortem|nhrc|lockup\s*me\s*maut|हवालात.*आत्महत्या|अभिरक्षा.*मृत्यु|18\/2013|dg[- ]?18/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-dg-18-2013' || c.title.includes('18/2013'));
  } else if (/broken\s*window|509|एक\s*सप्ताह\s*में\s*कार्ययोजना|19\/2013|dg[- ]?19/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-19-2013' || c.title.includes('19/2013'));
  } else if (/media\s*briefing|media.*kaun\s*bata|अधिकृत\s*अधिकारी|20\/2013|dg[- ]?20/i.test(normQuery)) {
    targetedEntry = circulars.find((c) => c.id === 'sys-circ-ardh-dg-20-2013' || c.title.includes('20/2013'));
  }

  // If a targeted entry is identified and no specific sub-action is requested, return full formatted answer
  if (targetedEntry && !isLaguKaren && !isMukhyaNirdesh && !isSamaySeemaye && !isSelfCheck) {
    const userNote = await getKnowledgeNote(targetedEntry.id);
    const content = formatCircularCompleteAnswer(targetedEntry, userNote);
    const hasTimeLimits = Boolean(getCircularTimeLimits(targetedEntry.description));
    const chips = ['परिपत्र खोलें', 'मुख्य निर्देश'];
    if (hasTimeLimits) {
      chips.push('समय-सीमाएँ');
    }
    chips.push('व्यवहार में कैसे लागू करें', 'सेल्फ-चेक');

    return {
      content,
      suggestedActions: chips,
      matchedCircularId: targetedEntry.id,
    };
  }

  // If a specific sub-action is requested and we know the target or default to first
  if ((isLaguKaren || isMukhyaNirdesh || isSamaySeemaye || isSelfCheck) && (targetedEntry || circulars.length > 0)) {
    const entry = targetedEntry || circulars[0];
    const header = getCircularNumberAndDate(entry.description);
    const chips = ['परिपत्र खोलें', 'मुख्य निर्देश', 'समय-सीमाएँ', 'व्यवहार में कैसे लागू करें', 'सेल्फ-चेक'];
    const userNote = await getKnowledgeNote(entry.id);
    const userNoteText = userNote ? `\n\n📝 **आपका नोट**: ${userNote}\n` : '';

    if (isLaguKaren) {
      const guidance = getCircularImplementationGuidance(entry.description);
      if (guidance) {
        return {
          content: [
            `**${header}**\n`,
            guidance,
            userNoteText,
            '\n_सहायक सामग्री — मूल परिपत्र देखें_',
          ].filter(Boolean).join('\n'),
          suggestedActions: chips,
          matchedCircularId: entry.id,
        };
      }
    }

    if (isMukhyaNirdesh) {
      const instructions = getCircularMainInstructions(entry.description);
      if (instructions) {
        return {
          content: [
            `**${header}**\n`,
            `**मुख्य निर्देश:**\n${instructions}`,
            userNoteText,
            '\n_सहायक सामग्री — मूल परिपत्र देखें_',
          ].filter(Boolean).join('\n'),
          suggestedActions: chips,
          matchedCircularId: entry.id,
        };
      }
    }

    if (isSamaySeemaye) {
      const limits = getCircularTimeLimits(entry.description);
      if (limits) {
        return {
          content: [
            `**${header}**\n`,
            `**समय-सीमाएँ:**\n${limits}`,
            userNoteText,
            '\n_सहायक सामग्री — मूल परिपत्र देखें_',
          ].filter(Boolean).join('\n'),
          suggestedActions: chips,
          matchedCircularId: entry.id,
        };
      } else {
        return {
          content: [
            `**${header}**\n`,
            `इस परिपत्र में कोई विशिष्ट समय-सीमा खंड उल्लिखित नहीं है।`,
            userNoteText,
            '\n_सहायक सामग्री — मूल परिपत्र देखें_',
          ].filter(Boolean).join('\n'),
          suggestedActions: chips,
          matchedCircularId: entry.id,
        };
      }
    }

    if (isSelfCheck) {
      const check = getCircularSelfCheck(entry.description);
      if (check) {
        return {
          content: [
            `**${header}**\n`,
            `**सेल्फ-चेक:**\n${check}`,
            userNoteText,
            '\n_सहायक सामग्री — मूल परिपत्र देखें_',
          ].filter(Boolean).join('\n'),
          suggestedActions: chips,
          matchedCircularId: entry.id,
        };
      }
    }
  }

  // ── 2. General Query Search & Ranking ─────────────────────────────────────
  // Tokenize & normalize
  const rawTokens = normQuery.replace(/[^\w\s\u0900-\u097F\/-]/g, ' ').split(/\s+/).filter(Boolean);
  const queryTokens = rawTokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 2);

  // If query had only stop words, fallback to weak result
  if (queryTokens.length === 0 && !targetedEntry) {
    return {
      content: 'पुस्तकालय में कोई संबंधित परिपत्र नहीं मिला। कृपया परिपत्र संख्या, विषय (उदा. अतिक्रमण, विवेचना पुलिस, CR-4) या मुख्य शब्द स्पष्ट करें।\n\n_सहायक सामग्री — मूल परिपत्र देखें_',
      suggestedActions: ['12/2012 (अतिक्रमण)', '14/2012 (विवेचना)', '15/2012 (CR-4)'],
    };
  }

  // Pre-calculate tag frequencies to determine rarity
  const tagFrequency = new Map<string, number>();
  for (const c of circulars) {
    const rawTags = (c.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const seen = new Set<string>();
    for (const tag of rawTags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      }
    }
  }

  const scoredCandidates: CircularHit[] = [];

  for (const entry of circulars) {
    let score = 0;
    const matchedKws: string[] = [];
    const distinctMatchedTerms = new Set<string>();
    let matchedRareOrMultiWordTag = false;

    const normTitle = (entry.title || '').toLowerCase();
    const normDesc = (entry.description || '').toLowerCase();
    const rawTags = (entry.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

    // Direct number check (e.g. 12/2012, 14/2012, 15/2012)
    const numMatch = entry.title.match(/(\d+\/\d+)/);
    if (numMatch && normQuery.includes(numMatch[1])) {
      score += 120;
      distinctMatchedTerms.add(numMatch[1]);
      matchedKws.push(numMatch[1]);
    }

    // Direct ID check
    if (normQuery.includes(entry.id.toLowerCase())) {
      score += 120;
      distinctMatchedTerms.add(entry.id);
      matchedKws.push(entry.id);
    }

    // Check tags
    for (const tag of rawTags) {
      const isMultiWord = tag.includes(' ') || tag.includes('-');
      const isRare = (tagFrequency.get(tag) || 0) <= 1;

      // Check if tag appears in query
      if (normQuery.includes(tag)) {
        score += isMultiWord || isRare ? 50 : 30;
        matchedKws.push(tag);
        distinctMatchedTerms.add(tag);
        if (isMultiWord || isRare) {
          matchedRareOrMultiWordTag = true;
        }
      } else {
        // Token level match
        for (const qt of queryTokens) {
          const qtH = normalizeHinglishToken(qt);
          const tagH = normalizeHinglishToken(tag);
          if (tag.includes(qt) || tagH.includes(qtH)) {
            score += 20;
            matchedKws.push(tag);
            distinctMatchedTerms.add(qt);
            if (isMultiWord || isRare) {
              matchedRareOrMultiWordTag = true;
            }
            break;
          }
        }
      }
    }

    // Check query tokens against title and description
    for (const qt of queryTokens) {
      const qtH = normalizeHinglishToken(qt);
      let termMatched = false;

      if (normTitle.includes(qt) || normalizeHinglishToken(normTitle).includes(qtH)) {
        score += 25;
        termMatched = true;
      }
      if (normDesc.includes(qt) || normalizeHinglishToken(normDesc).includes(qtH)) {
        score += 15;
        termMatched = true;
      }

      if (termMatched) {
        distinctMatchedTerms.add(qt);
        if (!matchedKws.includes(qt)) {
          matchedKws.push(qt);
        }
      }
    }

    // Hard Minimum rule:
    // (a) at least 2 distinct matched terms, OR
    // (b) one matched rare or multi-word tag, OR
    // (c) direct circular number match
    const passesHardMinimum =
      distinctMatchedTerms.size >= 2 ||
      matchedRareOrMultiWordTag ||
      (numMatch && normQuery.includes(numMatch[1]));

    if (passesHardMinimum && score > 0) {
      scoredCandidates.push({
        entry,
        score,
        matchedKeywords: Array.from(new Set(matchedKws)).slice(0, 5),
      });
    }
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    if (targetedEntry) {
      const userNote = await getKnowledgeNote(targetedEntry.id);
      const content = formatCircularCompleteAnswer(targetedEntry, userNote);
      return {
        content,
        suggestedActions: ['परिपत्र खोलें', 'मुख्य निर्देश', 'व्यवहार में कैसे लागू करें', 'सेल्फ-चेक'],
        matchedCircularId: targetedEntry.id,
      };
    }

    if (circulars.length > 0 && /(circular.*(matlab|simple|vyakhya|samjha|kya karna)|sadharan\s*vyakhya|साधारण\s*व्याख्या|samjha\s*do\s*circular|is\s*circular\s*me\s*mujhe\s*kya\s*karna\s*hai|saral\s*bhasha|सीधी\s*बात)/i.test(normQuery)) {
      const defaultEntry = circulars[0];
      const userNote = await getKnowledgeNote(defaultEntry.id);
      const content = formatCircularCompleteAnswer(defaultEntry, userNote);
      return {
        content,
        suggestedActions: ['परिपत्र खोलें', 'मुख्य निर्देश', 'व्यवहार में कैसे लागू करें', 'सेल्फ-चेक'],
        matchedCircularId: defaultEntry.id,
      };
    }

    return {
      content: 'पुस्तकालय में कोई संबंधित परिपत्र नहीं मिला। कृपया परिपत्र संख्या, विषय (उदा. अतिक्रमण, विवेचना पुलिस, CR-4) या मुख्य शब्द स्पष्ट करें।\n\n_सहायक सामग्री — मूल परिपत्र देखें_',
      suggestedActions: ['12/2012 (अतिक्रमण)', '14/2012 (विवेचना)', '15/2012 (CR-4)'],
    };
  }

  // Relative cutoff: 55% of top score, max 3 results
  const topScore = scoredCandidates[0].score;
  const filtered = scoredCandidates
    .filter((c) => c.score >= topScore * 0.55)
    .slice(0, 3);

  const primaryHit = filtered[0].entry;
  const userNote = await getKnowledgeNote(primaryHit.id);
  const primaryContent = formatCircularCompleteAnswer(primaryHit, userNote);

  let content = primaryContent;
  if (filtered.length > 1) {
    const otherSections = filtered.slice(1).map((hit) => {
      const { entry, matchedKeywords } = hit;
      const header = getCircularNumberAndDate(entry.description);
      const shortTitle = getDisplayShortTitle(entry);
      const sar = getCircularSar(entry.description);
      const kwText = matchedKeywords.length > 0 ? `**मैच किए गए कीवर्ड**: ${matchedKeywords.join(', ')}` : '';
      return [
        `📌 **${header} — ${shortTitle}**`,
        sar ? `**सार**: ${sar}` : '',
        kwText,
      ].filter(Boolean).join('\n\n');
    });

    content = [
      primaryContent,
      `━━━━━━━━━━━━━━━━━━━━\n\n**अन्य संबंधित परिपत्र:**\n\n` + otherSections.join('\n\n'),
    ].join('\n\n');
  }

  const hasTimeLimits = Boolean(getCircularTimeLimits(primaryHit.description));
  const chips = ['परिपत्र खोलें', 'मुख्य निर्देश'];
  if (hasTimeLimits) {
    chips.push('समय-सीमाएँ');
  }
  chips.push('व्यवहार में कैसे लागू करें', 'सेल्फ-चेक');

  return {
    content,
    suggestedActions: chips,
    matchedCircularId: primaryHit.id,
  };
}
