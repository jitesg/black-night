import {
  Scale, ClipboardList, Bell, FileText, Gavel, CheckSquare,
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
    id: 'Checklist',
    label: 'Checklist',
    icon: CheckSquare,
    color: '#0891B2',
    subcategories: [
      'Crime-wise Checklist', 'Arrest Checklist',
      'Court Checklist', 'Beat Checklist', 'General Checklist',
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
  { label: 'Checklist',     categoryId: 'Checklist' },
  { label: 'Police Format', categoryId: 'Police Format' },
];

// i18n key map — stable category id → translation key under knowledge.categories
const CATEGORY_I18N_KEY: Record<string, string> = {
  'Law':            'knowledge.categories.Law',
  'SOP':            'knowledge.categories.SOP',
  'Circular':       'knowledge.categories.Circular',
  'Court Judgment': 'knowledge.categories.CourtJudgment',
  'Checklist':      'knowledge.categories.Checklist',
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
