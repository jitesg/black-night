export type DefaultKaryvahiKey =
  | 'nakalChick'
  | 'nakalRapat'
  | 'bayanVadi'
  | 'ghatnasthal'
  | 'videography';

/**
 * Case-insensitive regex matching for the 5 mandatory default karyvahi.
 * Accepts both English/Hinglish and Hindi Devanagari names.
 */
export function matchDefaultKaryvahi(name: string): DefaultKaryvahiKey | null {
  if (!name) return null;

  if (/nakal\s*chick|नकल\s*चिक/i.test(name)) {
    return 'nakalChick';
  }
  if (/nakal\s*rapat|नकल\s*रपट|नकल\s*रापट/i.test(name)) {
    return 'nakalRapat';
  }
  if (/bayan\s*vadi|वादी.*बयान|बयान.*वादी/i.test(name)) {
    return 'bayanVadi';
  }
  if (/ghatnasthal|घटनास्थल/i.test(name)) {
    return 'ghatnasthal';
  }
  if (/videography|वीडियोग्राफी|e-?sakshya|ई-?साक्ष्य/i.test(name)) {
    return 'videography';
  }

  return null;
}
