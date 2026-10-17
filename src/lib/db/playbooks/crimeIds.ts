import crimeTaxonomySeed from '../../../../assets/seed/crime_taxonomy_seed.json';

const crimeTypes = ((crimeTaxonomySeed as { crimeTypes?: Array<{ id: string; name_en: string; name_hi?: string }> }).crimeTypes ||
  crimeTaxonomySeed) as Array<{
  id: string;
  name_en: string;
  name_hi?: string;
}>;

const KEY_PATTERNS: Record<string, Array<string | RegExp>> = {
  ROAD_ACCIDENT: ['road_accident', /^road accident$/i, /road accident/i, /death by negligence/i],
  RAPE: ['rape', /^rape$/i, /^rape\b/i],
  POCSO: ['pocso_sexual_assault', /pocso/i, /पॉक्सो/],
  KIDNAPPING: ['kidnapping_abduction', /kidnapping.*abduction/i, /kidnapping/i, /abduction/i],
  THEFT: ['theft', /^theft$/i, /theft/i],
  ROBBERY: ['robbery', /^robbery$/i, /robbery/i, /dacoity/i],
  CHEATING: ['cheating_fraud', /cheating.*fraud/i, /cheating/i, /fraud/i],
  CYBER: ['cyber_crime', /cyber/i, /ऑनलाइन धोखाधड़ी/],
  NDPS: ['ndps', /ndps/i, /मादक पदार्थ/],
  ARMS: ['arms_act', /arms act/i, /arms/i],
  DOWRY_DEATH: ['dowry_death', /dowry death/i],
  CRUELTY: ['cruelty_husband_relatives', /cruelty.*husband/i, /cruelty/i],
  HURT: ['hurt_grievous_hurt', /hurt.*grievous/i, /grievous.*hurt/i, /hurt/i],
  FORGERY: ['forgery_fake_documents', /forgery/i, /कूटरचना/],
  TRESPASS: ['criminal_trespass_housebreaking', /trespass.*house-?breaking/i, /trespass/i, /house-?breaking/i],
  BREACH_OF_TRUST: ['criminal_breach_of_trust', /breach of trust/i],
  EXTORTION_INTIMIDATION: ['criminal_intimidation_extortion', /intimidation.*extortion/i, /extortion/i, /intimidation/i],
  RIOTING: ['rioting_unlawful_assembly', /rioting/i, /दंगा/],
};

export const ALIAS_IDS: Record<string, string[]> = {
  RAPE: ['rape_gang_rape'],
  ROAD_ACCIDENT: ['death_by_negligence'],
  ROBBERY: ['dacoity', 'snatching'],
  CRUELTY: ['domestic_violence'],
};

export function resolveCrimeKeys(key: string): string[] {
  const primary = resolveCrimeKey(key);
  if (!primary) return [];

  const rawAliases = ALIAS_IDS[key] || ALIAS_IDS[key.toUpperCase()] || [];
  const validTaxonomyIds = new Set(crimeTypes.map((c) => c.id.toLowerCase()));

  const result: string[] = [primary];
  for (const a of rawAliases) {
    const trimmed = a.trim();
    if (validTaxonomyIds.has(trimmed.toLowerCase())) {
      const match = crimeTypes.find((c) => c.id.toLowerCase() === trimmed.toLowerCase());
      if (match && !result.includes(match.id)) {
        result.push(match.id);
      }
    }
  }

  return result;
}

export function resolveCrimeKey(key: string): string | undefined {
  if (!key) return undefined;

  // 1. Accept an exact flat id from crime_taxonomy_seed.json
  const exact = crimeTypes.find((c) => c.id.toLowerCase() === key.toLowerCase().trim());
  if (exact) return exact.id;

  const patterns = KEY_PATTERNS[key];
  if (!patterns) return undefined;

  for (const p of patterns) {
    const match = crimeTypes.find((c) => {
      if (typeof p === 'string') {
        return c.id.toLowerCase() === p.toLowerCase() || c.name_en.toLowerCase() === p.toLowerCase();
      }
      return p.test(c.name_en) || (c.name_hi && p.test(c.name_hi)) || p.test(c.id);
    });
    if (match) return match.id;
  }

  return undefined;
}
