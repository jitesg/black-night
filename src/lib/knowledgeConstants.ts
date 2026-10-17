import {
  Scale, ClipboardList, Bell, FileText, Gavel,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface KnowledgeCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  subcategories: string[];
}

/**
 * The 6 fixed Knowledge categories.
 *
 * Storage notes:
 *   - 'Checklist'     → knowledge_entries with category='Checklist'.
 *                       The Knowledge module also surfaces investigation_checklists
 *                       + checklist_items through a dedicated UI tile, but those
 *                       tables are owned by the Mukadma/FIR module and are NOT
 *                       modified here.
 *   - 'Police Format' → knowledge_entries with category='Police Format'.
 *                       Completely independent from predefined_formats /
 *                       System Format Manager — no cross-reads or cross-writes.
 *   - All others      → knowledge_entries with their respective category string.
 *
 * section_number column (v140) is meaningful for: Law, SOP, Circular,
 * Court Judgment.  It is nullable/optional for Checklist and Police Format.
 */
export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  {
    id: 'Law',
    label: 'Law',
    icon: Scale,
    color: '#1D4ED8',
    subcategories: [
      'BNS', 'BNSS', 'BSA',
      'Motor Vehicle Act', 'NDPS Act', 'Arms Act',
      'Excise Act', 'Other Acts',
    ],
  },
  {
    id: 'SOP',
    label: 'SOP',
    icon: ClipboardList,
    color: '#0F766E',
    subcategories: [
      'Investigation SOP', 'Arrest SOP', 'Court SOP',
      'Beat SOP', 'Departmental SOP',
    ],
  },
  {
    id: 'Circular',
    label: 'Circular',
    icon: Bell,
    color: '#B45309',
    subcategories: [
      'DGP Circulars', 'Government Orders',
      'Office Orders', 'Department Instructions',
    ],
  },
  {
    id: 'Court Judgment',
    label: 'Court Judgment',
    icon: Gavel,
    color: '#B91C1C',
    subcategories: [
      'Supreme Court', 'High Court',
      'Important Case Laws', 'Landmark Judgments',
    ],
  },
  {
    id: 'Police Format',
    label: 'Police Format',
    icon: FileText,
    color: '#7C3AED',
    subcategories: [
      'GD Formats', 'Prarthna Patra', 'BNSS Proceedings',
      'Court Reports', 'Miscellaneous Formats',
    ],
  },
];

export const KNOWLEDGE_CATEGORY_MAP: Record<string, KnowledgeCategory> =
  Object.fromEntries(KNOWLEDGE_CATEGORIES.map((c) => [c.id, c]));

// Analytics label → category id mapping
export const ANALYTICS_LABELS: { label: string; categoryId: string }[] = [
  { label: 'Law',           categoryId: 'Law' },
  { label: 'SOP',           categoryId: 'SOP' },
  { label: 'Circular',      categoryId: 'Circular' },
  { label: 'Court Judgment', categoryId: 'Court Judgment' },
  { label: 'Police Format', categoryId: 'Police Format' },
];

// i18n key map — stable category id → translation key under knowledge.categories
const CATEGORY_I18N_KEY: Record<string, string> = {
  'Law':            'knowledge.categories.Law',
  'SOP':            'knowledge.categories.SOP',
  'Circular':       'knowledge.categories.Circular',
  'Court Judgment': 'knowledge.categories.CourtJudgment',
  'Police Format':  'knowledge.categories.PoliceFormat',
};

/**
 * Returns the translated display label for a category id.
 * Falls back to the static English label if no translation key exists.
 * The underlying category `id` values are NEVER changed — only this display label varies.
 */
export function getCategoryLabel(
  categoryId: string,
  t: (key: string) => string,
): string {
  const key = CATEGORY_I18N_KEY[categoryId];
  if (key) return t(key);
  return KNOWLEDGE_CATEGORY_MAP[categoryId]?.label ?? categoryId;
}

/**
 * Normalizes any category string (English, Hindi, URL-encoded, or plural alias)
 * to its canonical category id: 'Law' | 'SOP' | 'Circular' | 'Court Judgment' | 'Police Format' | 'Checklist'
 */
export function getCanonicalCategory(raw: string | undefined | null): string {
  if (!raw) return '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    decoded = raw.trim();
  }
  const lower = decoded.toLowerCase();

  if (
    decoded === 'Circular' ||
    lower === 'circular' ||
    lower === 'circulars' ||
    decoded === 'परिपत्र' ||
    lower === 'peripatra'
  ) {
    return 'Circular';
  }
  if (
    decoded === 'SOP' ||
    lower === 'sop' ||
    lower === 'sops' ||
    decoded === 'एसओपी'
  ) {
    return 'SOP';
  }
  if (
    decoded === 'Court Judgment' ||
    lower === 'court judgment' ||
    lower === 'court judgments' ||
    decoded === 'अदालत का निर्णय' ||
    lower === 'courtjudgment' ||
    decoded === 'Court%20Judgment'
  ) {
    return 'Court Judgment';
  }
  if (
    decoded === 'Police Format' ||
    lower === 'police format' ||
    lower === 'police formats' ||
    decoded === 'पुलिस प्रारूप' ||
    lower === 'policeformat' ||
    decoded === 'Police%20Format'
  ) {
    return 'Police Format';
  }
  if (
    decoded === 'Law' ||
    lower === 'law' ||
    lower === 'laws' ||
    decoded === 'Laws & Sections' ||
    decoded === 'विधि पुस्तकालय'
  ) {
    return 'Law';
  }
  if (
    decoded === 'Checklist' ||
    lower === 'checklist' ||
    lower === 'checklists' ||
    decoded === 'चेकलिस्ट'
  ) {
    return 'Checklist';
  }

  // Exact match with known category id
  if (KNOWLEDGE_CATEGORY_MAP[decoded]) return decoded;

  return decoded;
}

/**
 * Returns all database category variants that match a given category.
 * Ensures queries find both singular and plural forms (e.g. 'SOP' and 'SOPs').
 */
export function getCategoryVariants(category: string): string[] {
  const canonical = getCanonicalCategory(category);
  switch (canonical) {
    case 'Circular':
      return ['Circular', 'Circulars', 'परिपत्र'];
    case 'SOP':
      return ['SOP', 'SOPs', 'एसओपी'];
    case 'Court Judgment':
      return ['Court Judgment', 'Court Judgments', 'अदालत का निर्णय'];
    case 'Police Format':
      return ['Police Format', 'Police Formats', 'पुलिस प्रारूप'];
    case 'Law':
      return ['Law', 'Laws & Sections', 'विधि पुस्तकालय'];
    case 'Checklist':
      return ['Checklist', 'Checklists', 'चेकलिस्ट'];
    default:
      return [canonical || category];
  }
}

