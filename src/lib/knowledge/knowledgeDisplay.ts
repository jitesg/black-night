/**
 * knowledgeDisplay.ts
 *
 * Central utilities for Knowledge card & detail display:
 * - Display-time short title extracted from "सार:"
 * - Circular number chip extraction ("परिपत्र 12/2012", etc.)
 * - Display title overrides for circulars 12/2012, 14/2012, 15/2012
 * - Single source of truth for derived status: getEntryStatus(entry, hasNote)
 */

export const DISPLAY_TITLE_OVERRIDES: Record<string, string> = {
  // 2012 Circulars
  'sys-circ-dg-women-safety-2012': 'महिलाओं के विरुद्ध अपराध रोकने हेतु गश्त, सादे कपड़ों की ड्यूटी, हेल्पलाइन और तत्काल जाँच',
  'sys-circ-dg-4-2012': 'विवेचना में फील्ड यूनिट से तुरंत भौतिक साक्ष्य (खून, DNA, फिंगरप्रिंट) का संकलन',
  'sys-circ-dg-3-2012': 'अवैध शराब पर सख्ती; शराब से मृत्यु पर थानाध्यक्ष और पर्यवेक्षण अधिकारी की जिम्मेदारी',
  'sys-circ-dg-11-2012': 'जमानतीय अपराध में युवा, बिना इतिहास वाले अभियुक्त की बंधपत्र पर तत्काल रिहाई',
  'sys-circ-dg-9-2012': 'अभियुक्त के कहने पर विवेचना स्थानांतरण नहीं; विशेष स्थिति में कारणयुक्त आदेश, एक बार',
  'sys-circ-dg-12-2012': 'सड़क/फुटपाथ से अतिक्रमण हटने के बाद दोबारा अतिक्रमण पर बीट प्रभारी जिम्मेदार',
  'sys-circ-ardh-14-2012': '10 लाख+ आबादी वाले क्षेत्रों में विवेचना पुलिस, कानून-व्यवस्था पुलिस से अलग',
  'sys-circ-dg-15-2012': 'पेशेवर अपराधियों के विरुद्ध साक्ष्य और ज़मानत निरस्तीकरण (CR-4 प्रक्रिया)',
  'sys-circ-ardh-dg-15-2012': 'पेशेवर अपराधियों के विरुद्ध साक्ष्य और ज़मानत निरस्तीकरण (CR-4 प्रक्रिया)',

  // 2013 Circulars (Task L25)
  'sys-circ-ardh-dg-6-2013': 'गुमशुदा बच्चों की सूचना ट्रैक द मिसिंग चाइल्ड पोर्टल पर अपलोड करना',
  'sys-circ-dg-7-2013': 'ईव टीज़िंग रोकने के लिए सुप्रीम कोर्ट के 7 निर्देशों का पालन',
  'sys-circ-ardh-dg-8-2013': 'शेष 647 विसरा तुरंत प्रयोगशाला भेजना; मासिक समीक्षा',
  'sys-circ-dg-5-2013': 'जहर से मृत्यु वाले विसरा प्राथमिकता से रासायनिक परीक्षण हेतु भेजना',
  'sys-circ-dg-road-safety-week-2013': 'सड़क सुरक्षा सप्ताह 17–23 मार्च 2013 और कार्यवाही विवरण',
  'sys-circ-dg-women-media-2013': 'महिला अपराधों की प्रेस ब्रीफिंग में संवेदनशीलता; पीड़िता पर दोष नहीं',
  'sys-circ-dg-1-2013': 'वाहनों के शीशों की काली फिल्म हटाने का 10 दिवसीय अभियान',
  'sys-circ-dg-2-2013': 'आरोप-पत्र के समय अभियुक्त की न्यायालय में उपस्थिति (धारा 170)',
  'sys-circ-ardh-dg-3-2013': 'हत्या-बलात्कार विवेचना: घटनास्थल सुरक्षा, वीडियो बयान, पर्यवेक्षक की राय',
  'sys-circ-ardh-dg-4-2013': 'NDPS धारा 41/42: कारण लिखकर तलाशी और 72 घंटे में सूचना',
  'sys-circ-ardh-dg-75-2013': 'क्राइम ब्रांच कौन से अपराध लेगी; थानाध्यक्ष सह-विवेचक',
  'sys-circ-dg-lalita-kumari-2013': 'संज्ञेय अपराध पर FIR अनिवार्य; प्रारंभिक जाँच 7 दिन; गिरफ्तारी अनिवार्य नहीं',
  'sys-circ-dg-court-cases-service-2013': 'सेवा संबंधी कोर्ट मामलों में अभिलेख सहित जानकार कर्मी मुख्यालय भेजें',
  'sys-circ-dg-73-2013': 'धारा 363/366: FD का आदेश केवल एक याचिका के लिए (70/2013 स्पष्टीकरण)',
  'sys-circ-ardh-dg-72-2013': 'अधीनस्थों से संवाद, कल्याण, निष्पक्ष जाँच और समस्या-रजिस्टर',
  'sys-circ-dg-71-2013': 'जमानत की प्रस्तरवार टिप्पणी में आपराधिक इतिहास सही जगह लिखें',
  'sys-circ-dg-70-2013': 'धारा 363/366: हाईकोर्ट आदेश पूरे करके ही अंतिम रिपोर्ट',

  // 2013 Circulars (Task L26: 11/2013 to 20/2013)
  'sys-circ-ardh-dg-11-2013': 'किशोर/बच्चों के प्रति पुलिस कार्यवाही; बाल कल्याण अधिकारी व SJPU के कर्तव्य',
  'sys-circ-dg-12-2013': 'गुमशुदा बच्चे: धारा 363 में तुरंत FIR, 24 घंटे में सूचना व Track Child',
  'sys-circ-ardh-dg-13-2013': 'महिला अपराधों में पुलिस प्रक्रिया: महिला अधिकारी, वीडियो, बयान घर पर',
  'sys-circ-dg-14-2013': 'गोवध/गोवंश अवैध परिवहन रोकथाम: चेकिंग, सैंपलिंग, गौशाला सुपुर्दगी',
  'sys-circ-ardh-dg-15-2013': 'सनसनीखेज घटनाओं की सूचना तुरंत मुख्यालय को; SP सीधे फोन करें',
  'sys-circ-dg-16-2013': 'महिला अपराध: विवेचना, सादे वेश में महिला आरक्षी, गाँव भ्रमण 15 दिन में',
  'sys-circ-dg-17-2013': 'रोडजाम/उपद्रव: न्यूनतम बल, चेतावनी, वीडियोग्राफी, PDPP Act',
  'sys-circ-dg-18-2013': 'हवालात में आत्महत्या रोकथाम और अभिरक्षा में मृत्यु पर कार्यवाही',
  'sys-circ-ardh-dg-19-2013': 'महिला अपराध: Broken Window, सही धाराएँ, पैरवी, एक सप्ताह में कार्ययोजना',
  'sys-circ-ardh-dg-20-2013': 'मीडिया ब्रीफिंग केवल अधिकृत अधिकारी; अन्य पर अनुशासनात्मक कार्यवाही',
};

/**
 * Extracts circular number chip e.g. "परिपत्र 12/2012", "परिपत्र (संख्या अस्पष्ट)/2012" from title or ID.
 */
export function getCircularNumberChip(entry: { id: string; title: string }): string | null {
  const { id, title } = entry;

  // Women safety circular (2012) has unclear circular number
  if (
    id.includes('women-safety') ||
    (id.includes('2012') && ((title || '').includes('संख्या-अस्पष्ट') || (title || '').includes('संख्या अस्पष्ट') || (title || '').includes('महिलाओं के विरुद्ध')))
  ) {
    return 'परिपत्र (संख्या अस्पष्ट)/2012';
  }

  // 2013 circulars with unclear circular number
  if (
    id.includes('road-safety-week') ||
    id.includes('women-media') ||
    id.includes('court-cases-service') ||
    id.includes('lalita-kumari') ||
    (id.includes('2013') && ((title || '').includes('संख्या अस्पष्ट') || (title || '').includes('संख्या रिक्त') || (title || '').includes('संख्या-अस्पष्ट')))
  ) {
    return 'परिपत्र (संख्या अस्पष्ट)/2013';
  }

  // Match pattern like "संख्या-12/2012", "12/2012", "14/2012", "15/2012", "3/2012", "4/2012", "संख्या-01/2013"
  const mTitle = (title || '').match(/(?:संख्या[-–\s]*)?(\d+\/\d{4})/);
  if (mTitle) {
    const cleanNum = mTitle[1].replace(/^0+(\d)/, '$1');
    return `परिपत्र ${cleanNum}`;
  }

  // Fallback to id parsing like "12-2012", "3-2012", "4-2012"
  const mId = (id || '').match(/(\d+)[-_](\d{4})/);
  if (mId) {
    const cleanNum = `${parseInt(mId[1], 10)}/${mId[2]}`;
    return `परिपत्र ${cleanNum}`;
  }

  return null;
}

/**
 * Generates a short display title from "सार:" at display time (nothing stored).
 * If overridden for circulars, uses the exact required strings.
 * If an entry has no "सार:" line, returns its current title.
 */
export function getDisplayShortTitle(entry: { id: string; title: string; description?: string }): string {
  // Check exact ID override
  if (DISPLAY_TITLE_OVERRIDES[entry.id]) {
    return DISPLAY_TITLE_OVERRIDES[entry.id];
  }

  // Check matching by circular number or key token in ID or title
  if (entry.id.includes('women-safety') || entry.title.includes('संख्या-अस्पष्ट') || entry.title.includes('महिलाओं के विरुद्ध')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-women-safety-2012'];
  }
  if (entry.id.includes('4-2012') || entry.title.includes('4/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-4-2012'];
  }
  if (entry.id.includes('3-2012') || entry.title.includes('3/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-3-2012'];
  }
  if (entry.id.includes('11-2012') || entry.title.includes('11/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-11-2012'];
  }
  if (entry.id.includes('9-2012') || entry.title.includes('9/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-9-2012'];
  }
  if (entry.id.includes('12-2012') || entry.title.includes('12/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-12-2012'];
  }
  if (entry.id.includes('14-2012') || entry.title.includes('14/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-14-2012'];
  }
  if (entry.id.includes('15-2012') || entry.title.includes('15/2012')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-15-2012'];
  }

  // 2013 fallbacks
  if (entry.id.includes('11-2013') || entry.title.includes('11/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-dg-11-2013'];
  }
  if (entry.id.includes('12-2013') || entry.title.includes('12/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-12-2013'];
  }
  if (entry.id.includes('13-2013') || entry.title.includes('13/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-dg-13-2013'];
  }
  if (entry.id.includes('14-2013') || entry.title.includes('14/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-14-2013'];
  }
  if (entry.id.includes('15-2013') || entry.title.includes('15/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-dg-15-2013'];
  }
  if (entry.id.includes('16-2013') || entry.title.includes('16/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-16-2013'];
  }
  if (entry.id.includes('17-2013') || entry.title.includes('17/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-17-2013'];
  }
  if (entry.id.includes('18-2013') || entry.title.includes('18/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-dg-18-2013'];
  }
  if (entry.id.includes('19-2013') || entry.title.includes('19/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-dg-19-2013'];
  }
  if (entry.id.includes('20-2013') || entry.title.includes('20/2013')) {
    return DISPLAY_TITLE_OVERRIDES['sys-circ-ardh-dg-20-2013'];
  }

  const desc = entry.description || '';
  const sarIdx = desc.indexOf('सार:');
  if (sarIdx !== -1) {
    const afterSar = desc.slice(sarIdx + 4).trim();
    // take text up to the first "।" or ";" or newline
    const firstDelim = afterSar.search(/[।;\n]/);
    let extracted = firstDelim !== -1 ? afterSar.slice(0, firstDelim).trim() : afterSar;

    if (extracted.length > 70) {
      // cut at word boundary within 70 chars + "…"
      const truncated = extracted.slice(0, 70);
      const lastSpace = truncated.lastIndexOf(' ');
      extracted = (lastSpace > 35 ? truncated.slice(0, lastSpace) : truncated) + '…';
    }

    if (extracted.length > 5) {
      return extracted;
    }
  }

  return entry.title;
}

/**
 * Parsed structure of [[SADHARAN]] ... [[/SADHARAN]] block.
 */
export interface SadharanBlock {
  heading: string;
  seedhiBaat: string;
  aapkoKyaKarnaHai: string[];
  kyaNaKaren: string[];
  ekLineMeYaadRakhen: string;
  rawText: string;
}

/**
 * Parses the [[SADHARAN]] ... [[/SADHARAN]] block inside circular descriptions.
 */
export function parseSadharanBlock(description?: string): SadharanBlock | null {
  if (!description) return null;
  const match = description.match(/\[\[SADHARAN\]\]([\s\S]*?)\[\[\/SADHARAN\]\]/i);
  if (!match || !match[1]) return null;

  const rawText = match[1].trim();
  const lines = rawText.split('\n').map((l) => l.trim());

  let heading = 'साधारण व्याख्या (सरल और व्यावहारिक)';
  if (lines.length > 0 && lines[0]) {
    heading = lines[0];
  }

  let seedhiBaat = '';
  const aapkoKyaKarnaHai: string[] = [];
  const kyaNaKaren: string[] = [];
  let ekLineMeYaadRakhen = '';

  const sbMatch = rawText.match(/सीधी\s*बात\s*:\s*([\s\S]*?)(?=\n\s*(?:आपको\s*क्या\s*करना\s*है|क्या\s*न\s*करें|एक\s*लाइन\s*में\s*याद\s*रखें|$))/i);
  if (sbMatch && sbMatch[1]) {
    seedhiBaat = sbMatch[1].trim();
  }

  const akMatch = rawText.match(/आपको\s*क्या\s*करना\s*है\s*:\s*([\s\S]*?)(?=\n\s*(?:क्या\s*न\s*करें|एक\s*लाइन\s*में\s*याद\s*रखें|$))/i);
  if (akMatch && akMatch[1]) {
    const rawBullets = akMatch[1].split('\n').map((l) => l.trim()).filter(Boolean);
    for (const b of rawBullets) {
      aapkoKyaKarnaHai.push(b.replace(/^[•\-\*]\s*/, '').trim());
    }
  }

  const knMatch = rawText.match(/क्या\s*न\s*करें\s*:\s*([\s\S]*?)(?=\n\s*(?:एक\s*लाइन\s*में\s*याद\s*रखें|$))/i);
  if (knMatch && knMatch[1]) {
    const rawBullets = knMatch[1].split('\n').map((l) => l.trim()).filter(Boolean);
    for (const b of rawBullets) {
      kyaNaKaren.push(b.replace(/^[•\-\*]\s*/, '').trim());
    }
  }

  const elMatch = rawText.match(/एक\s*लाइन\s*में\s*याद\s*रखें\s*:\s*([\s\S]*?)$/i);
  if (elMatch && elMatch[1]) {
    ekLineMeYaadRakhen = elMatch[1].trim();
  }

  return {
    heading,
    seedhiBaat,
    aapkoKyaKarnaHai,
    kyaNaKaren,
    ekLineMeYaadRakhen,
    rawText,
  };
}

/**
 * Strips [[SADHARAN]] ... [[/SADHARAN]] block completely from description.
 * Used on detail screen so the main description doesn't repeat the block.
 */
export function stripSadharanBlock(description?: string): string {
  if (!description) return '';
  return description.replace(/\[\[SADHARAN\]\][\s\S]*?\[\[\/SADHARAN\]\]\n*/gi, '').trim();
}

/**
 * Strips just the markers [[SADHARAN]] and [[/SADHARAN]], keeping content.
 * Ensures [[SADHARAN]] markers are NEVER visible anywhere.
 */
export function stripSadharanMarkers(text?: string): string {
  if (!text) return '';
  return text.replace(/\[\[\/?SADHARAN\]\]/gi, '').trim();
}

/**
 * Extracts "सीधी बात:" text for card preview.
 * Falls back to null if not found.
 */
export function extractSeedhiBaat(description?: string): string | null {
  const parsed = parseSadharanBlock(description);
  if (parsed && parsed.seedhiBaat) {
    return parsed.seedhiBaat;
  }
  return null;
}

/**
 * Returns the 2-line preview text for cards:
 * Uses "सीधी बात:" if available; otherwise description with any [[SADHARAN]] markers stripped.
 */
export function getEntryPreviewText(description?: string): string {
  if (!description) return '';
  const seedhi = extractSeedhiBaat(description);
  if (seedhi) {
    return seedhi;
  }
  return stripSadharanMarkers(description);
}

/**
 * Single shared helper for derived entry status:
 * - A system entry WITH a non-empty note flips to "user" (उपयोगकर्ता)
 * - The moment note is cleared it returns to "system" (सिस्टम)
 * - User-created entries are always "user"
 */
export function getEntryStatus(
  entry: { source?: string },
  hasNote: boolean
): 'system' | 'user' {
  if (entry.source !== 'system') {
    return 'user';
  }
  return hasNote ? 'user' : 'system';
}

/**
 * Extracts and formats the circular date:
 * Where the circular date is unclear (19/2013, 20/2013: "मई 2013") shows month/year only.
 */
export function getCircularDisplayDate(description?: string): string {
  if (!description) return '';
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
  const dateLine = lines.find((l) => l.startsWith('दिनांक:'));
  if (!dateLine) return '';
  if (dateLine.includes('मई 2013')) {
    return 'मई 2013';
  }
  return dateLine.replace(/^दिनांक:\s*/, '').trim();
}
