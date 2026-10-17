export interface FardMarker {
  label: string;
  kws: string[];
}

export interface FardEntry {
  code: string;
  name: string;
  when: string;
  purpose: string;
  legal: string;
  essentials: string[];
  wording: string[];
  mistakes: string[];
  court: string[];
  docs: string[];
  keywords: string[];
  markers: FardMarker[];
}
