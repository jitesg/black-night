// NOTE: Crime Types are loaded dynamically from the Knowledge Module (Investigation Checklists).
// Knowledge Module is the Single Source of Truth (SSOT) for Crime Type definitions.
// Do NOT add a hardcoded CRIME_TYPES list here — use checklistRepo.getUniqueCrimeTypes() instead.

// Sort options
export const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'FIR Number', value: 'fir_number' },
  { label: 'Complainant Name', value: 'complainant' },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

// Case diary formats (Type = Case Diary)
export const CASE_DIARY_FORMATS: { id: string; title: string; template: string }[] = [
  {
    id: 'fmt_arrest',
    title: 'Giraftari (Arrest) Format',
    template:
      'Thana _______ ka Pradhan Aarakshi _______ dwara accused _______ ko _______ se giraftaar kiya gaya. Giraftari ka karan _______ hai. Giraftari ke samay accused ke paas _______ baraamad hua. Giraftari _______ bajon hui.',
  },
  {
    id: 'fmt_search',
    title: 'Talashi (Search) Format',
    template:
      'Panchon ki maujoodgi mein _______ makan/jagah par talashi li gayi. Talashi ke dauran _______ baraamad hua / kuch baraamad nahi hua. Panchnama tayyar kiya gaya.',
  },
  {
    id: 'fmt_site',
    title: 'Ghatnasthal Nirikshan Format',
    template:
      'Ghatnasthal _______ par mauka muaina kiya gaya. Ghatnasthal ki haalat _______ thi. Kuch kaabilegaur nishaniyan/saboot mile: _______. Muaina team mein shaamil: _______.',
  },
  {
    id: 'fmt_witness',
    title: 'Gawah Bayan Format',
    template:
      'Gawah ka naam: _______, pita ka naam: _______, pata: _______. Gawah ne bataya ki ghatna ke samay woh _______ par the. Unhone _______ dekha/suna. Bayan swayamsevik roop se diya gaya.',
  },
  {
    id: 'fmt_remand',
    title: 'Remand Report Format',
    template:
      'Maananiya Nyaayaadhish mahodaya ke samaksh accused _______ ko prastut kiya gaya. Accused ki nyaayik abhiraksha _______ dinon ke liye maangi gayi, kyunki _______. Anumati di gayi / nahi di gayi.',
  },
];

// Bail status display
export const BAIL_STATUS_LABELS: Record<string, string> = {
  unknown: 'Status Unknown',
  in_jail: 'In Jail After Remand',
  on_bail: 'Out On Bail',
};
