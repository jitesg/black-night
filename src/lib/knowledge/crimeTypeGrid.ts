/**
 * चेकलिस्ट "अपराध प्रकार" grid (owner, ज्ञानकोष new layout part 7): which crime types the checklist items cover, with counts and an
 * emoji per type (crime_taxonomy_seed ids). Pure — tests scripts/test_knowledge_visits.ts.
 */
export const CRIME_EMOJI: Record<string, string> = {
  murder: '🔪', attempt_to_murder: '🗡️', culpable_homicide: '⚰️', death_by_negligence: '⚠️', hurt_grievous_hurt: '🩸',
  assault_criminal_force: '💔', rape: '🚺', sexual_harassment: '👩', kidnapping_abduction: '🚐', human_trafficking_unlawful_compulsory_labour: '⛓️',
  rape_gang_rape: '🚺', pocso_sexual_assault: '🧒', dowry_death: '💍', cruelty_husband_relatives: '🏠', domestic_violence: '🏠',
  theft: '💰', robbery: '🏃', dacoity: '🔫', snatching: '👜', criminal_breach_of_trust: '🤝', cheating_fraud: '🎭',
  forgery_fake_documents: '📄', criminal_trespass_housebreaking: '🚪', cyber_crime: '💻', ndps: '💊', arms_act: '🔫',
  sc_st_act: '⚖️', road_accident: '🚗', rioting_unlawful_assembly: '👥', criminal_intimidation_extortion: '😠',
};

export function crimeEmoji(id: string): string {
  return CRIME_EMOJI[String(id ?? '').toLowerCase()] ?? '📋';
}

/** Crime types used by the items, most items first (then by id); each item counted once per type. */
export function crimeTypeCounts(items: readonly { pairs: readonly { crimeType: string }[] }[]): { id: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    for (const id of new Set(it.pairs.map((p) => String(p.crimeType ?? '').trim()).filter(Boolean))) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** Items of one crime type (null = all). */
export function itemsOfCrime<T extends { pairs: readonly { crimeType: string }[] }>(items: readonly T[], crime: string | null): T[] {
  return crime ? items.filter((i) => i.pairs.some((p) => p.crimeType === crime)) : items.slice();
}
