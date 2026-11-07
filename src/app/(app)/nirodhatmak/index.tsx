import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, Dimensions, FlatList, LayoutAnimation, Modal, Platform, Pressable,
  Text, View,
} from 'react-native';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  FileWarning, Plus, ChevronDown,
  Edit2, Trash2, MapPin, Calendar, CalendarDays, FileDown, Check, Clock, MoreVertical, CheckCheck, ChevronUp, X,
} from 'lucide-react-native';
import { exportKaryvahiDocx, exportKaryvahisDocx } from '@/lib/nirodhatmak/karyvahiDocx';
import { SearchBar } from '@/components/SearchBar';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import { nkMatchesFilters } from '@/lib/nirodhatmak/nkFilter';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { HighlightText } from '@/components/HighlightText';
import {
  getAllNirodhatmakKaryvahi, searchNirodhatmakKaryvahi, deleteNirodhatmakKaryvahi,
  NIRODHATMAK_TYPES,
  type NirodhatmakKaryvahi, type NirodhatmakType,
  KARYVAHI_CHECKLIST, parseKaryvahiChecklist, setKaryvahiChecklist, type KaryvahiChecklist,
} from '@/lib/db/nirodhatmakRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';
import { extractKaryvahiFacts } from '@/lib/nirodhatmak/extractKaryvahi';

const MODULE_COLOR = '#DC2626';

// Chip inactive tokens — readable on bg-background in both themes




const NIRODHATMAK_TYPE_KEYS: Record<string, string> = {
  'बीट सूचना':    'beatInfo',
  'मुकदमा':       'case',
  'प्रार्थनापत्र': 'petition',
  'जमीनी विवाद':  'landDispute',
  'अन्य':         'other',
};

// ─── Action Menu (small floating popup next to the ⋮ button) ─────────────
type MenuAnchor = { x: number; y: number; w: number; h: number };
const MENU_W = 196;
const MENU_ROW_H = 44;

function ActionMenu({
  anchor, onEdit, onExport, onDelete, onClose, scheme,
}: {
  anchor: MenuAnchor;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClose: () => void;
  scheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const palette = THEME[scheme];
  const { width: sw, height: sh } = Dimensions.get('window');
  const menuH = MENU_ROW_H * 3 + 8;
  // Right edge under the ⋮ button; opens upwards when there is no room below.
  const left = Math.max(8, Math.min(anchor.x + anchor.w - MENU_W, sw - MENU_W - 8));
  const below = anchor.y + anchor.h + 4;
  const top = below + menuH > sh - NAV_BAR_INSET - 8 ? Math.max(8, anchor.y - menuH - 4) : below;
  const row = (icon: React.ReactNode, label: string, onPress: () => void, danger = false) => (
    <Pressable
      onPress={onPress}
      className="active:opacity-60"
      style={{ height: MENU_ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
      accessibilityRole="menuitem"
    >
      {icon}
      <Text style={{ fontSize: 14, color: danger ? palette.destructive : palette.foreground }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('nirodhatmak.menu.closeAccessibility')}>
        <View
          style={{
            position: 'absolute', left, top, width: MENU_W, paddingVertical: 4, borderRadius: 12,
            backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border,
            shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
          }}
        >
          {row(<Edit2 size={16} color={palette.foreground} />, t('common.edit'), onEdit)}
          {row(<FileDown size={16} color={palette.foreground} />, 'Word में export', onExport)}
          {row(<Trash2 size={16} color={palette.destructive} />, t('common.delete'), onDelete, true)}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────
// Same look as the home dashboard tiles (owner): theme card surface, no border, soft shadow, rounded 16,
// the headline (village) big and bold in the accent green, small muted labels. Content is unchanged:
// village (pin + "गाँव का नाम"), कार्यवाही type, dispute in a serif Hindi face with an opening quote,
// checklist, then date (left) and the section badge (right).
// Village / dispute / sections are read from the editor text (fallbacks: saved fields).
const CARD_COLORS = {
  dark: {
    bg: THEME.dark.card, border: THEME.dark.border, pinBg: '#DC262626', pin: '#F87171', muted: THEME.dark.mutedForeground,
    village: '#16A34A', type: '#D97706', dispute: '#EF4444', divider: THEME.dark.border, badgeBg: '#0F766E33', badgeFg: '#5EEAD4',
    // चलानी लंबित = light red line + faint red card, प्रेषित = light green (owner, design "C"; tint = 6% over the card)
    pendLine: '#F8717199', pendBg: '#292D24', doneLine: '#4ADE8099', doneBg: '#1C3526',
  },
  light: {
    bg: THEME.light.card, border: THEME.light.border, pinBg: '#DC26261A', pin: '#DC2626', muted: THEME.light.mutedForeground,
    village: '#16A34A', type: '#D97706', dispute: '#DC2626', divider: THEME.light.border, badgeBg: '#0F766E1A', badgeFg: '#0F766E',
    pendLine: '#F87171', pendBg: '#FEF3F3', doneLine: '#4ADE80', doneBg: '#F1FBF5',
  },
} as const;
// "Kokila" is not on phones; Android's serif face carries Noto Serif Devanagari.
const SERIF_HINDI = Platform.select({ android: 'serif', ios: 'Kohinoor Devanagari', default: 'Kokila, "Noto Serif Devanagari", serif' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cardDate(item: NirodhatmakKaryvahi): string {
  const raw = item.proceeding_date ?? '';
  let d: Date | null = null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
  else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(raw))) d = new Date(+m[3], +m[2] - 1, +m[1]);
  else if (item.created_at) d = new Date(item.created_at < 10000000000 ? item.created_at * 1000 : item.created_at);
  if (!d || isNaN(d.getTime())) return raw;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const KaryvahiCard = memo(function KaryvahiCard({
  item,
  query,
  scheme,
  onPress,
  onLongPress,
  onMenu,
  selecting,
  selected,
}: {
  item: NirodhatmakKaryvahi;
  query: string;
  scheme: 'light' | 'dark';
  onPress: () => void;
  onLongPress: () => void;
  /** ⋮ button: the संपादित / Word / हटाएं menu (gets the button's place on screen). */
  onMenu: (anchor: MenuAnchor) => void;
  /** Selection mode (press-and-hold): show a tick circle instead of ⋮. */
  selecting?: boolean;
  selected?: boolean;
}) {
  const { t } = useTranslation();
  const c = CARD_COLORS[scheme];
  const dateStr = cardDate(item);
  const menuBtnRef = useRef<View>(null);
  const facts = useMemo(
    () => extractKaryvahiFacts(item.editor_content || item.report_text || ''),
    [item.editor_content, item.report_text],
  );
  const rawVillage = (facts.village || item.village_name || '').trim();
  // Shown as "ग्राम <नाम>" (the text extractor drops the word ग्राम).
  const village = rawVillage && !/^ग्राम/.test(rawVillage) ? `ग्राम ${rawVillage}` : rawVillage;
  // Dispute: the format's "विवाद का कारण" (Matter) value when it was saved; else read from the text.
  const dispute = useMemo(() => {
    try {
      const v = JSON.parse(item.values_json || '{}') as Record<string, unknown>;
      const key = Object.keys(v).find((k) => /^matter$|vivad|dispute|विवाद/i.test(k) && String(v[k] ?? '').trim());
      if (key) return String(v[key]).trim();
    } catch { /* old rows */ }
    return facts.dispute;
  }, [item.values_json, facts.dispute]);
  const typeLabel = NIRODHATMAK_TYPE_KEYS[item.proceeding_type]
    ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[item.proceeding_type])
    : (item.proceeding_type || t('nirodhatmak.type.other'));
  const sections = facts.sections.length ? facts.sections : [typeLabel];
  // Card colour follows the "चलानी प्रेषित" tick (updated at once when it is ticked on the card).
  const [prashit, setPrashit] = useState(() => !!parseKaryvahiChecklist(item.checklist_json).prashit);
  useEffect(() => { setPrashit(!!parseKaryvahiChecklist(item.checklist_json).prashit); }, [item.checklist_json]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="shadow-sm shadow-black/5 active:opacity-70"
      style={{
        borderCurve: 'continuous', borderRadius: 16, padding: 16, backgroundColor: prashit ? c.doneBg : c.pendBg,
        // light red (चलानी लंबित) / light green (प्रेषित) line; the red module ring while selected
        borderWidth: 2, borderColor: selected ? MODULE_COLOR : (prashit ? c.doneLine : c.pendLine),
      }}
      accessibilityRole="button"
      accessibilityLabel={[village, typeLabel, dispute, dateStr, sections.join(', ')].filter(Boolean).join(', ')}
    >
      {/* 1. Village: pin circle aligned with the label's top edge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, marginTop: 1, backgroundColor: c.pinBg, alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={11} color={c.pin} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 11, lineHeight: 14, color: c.muted, letterSpacing: 0.2 }}>गाँव का नाम</Text>
          {village ? (
            <HighlightText
              text={village}
              query={query}
              style={{ fontSize: 20, lineHeight: 30, fontWeight: '700', color: c.village }}
              numberOfLines={2}
            />
          ) : (
            <Text style={{ fontSize: 20, lineHeight: 30, fontWeight: '700', color: c.muted }} numberOfLines={1}>
              {t('nirodhatmak.card.defaultTitle')}
            </Text>
          )}
          {/* कार्यवाही का प्रकार (e.g. बीट सूचना) */}
          <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: c.type }}>
            {typeLabel}
          </Text>
        </View>
        {/* ⋮ — same menu as press-and-hold (संपादित / Word export / हटाएं) */}
        {selecting ? (
          <View style={{
            width: 24, height: 24, borderRadius: 12, marginTop: -2, borderWidth: 2,
            borderColor: selected ? MODULE_COLOR : c.muted, backgroundColor: selected ? MODULE_COLOR : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {selected ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
        ) : (
          <Pressable
            ref={menuBtnRef}
            onPress={() => menuBtnRef.current?.measureInWindow((x, y, w, h) => onMenu({ x, y, w, h }))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="और विकल्प"
            style={{ width: 32, height: 32, marginTop: -6, marginRight: -8, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
            className="active:opacity-50"
          >
            <MoreVertical size={20} color={c.muted} />
          </Pressable>
        )}
      </View>

      {/* 2. Dispute — serif Hindi, coral, opening quote */}
      {dispute ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingLeft: 32 }}>
          <Text style={{ fontFamily: SERIF_HINDI, fontSize: 20, lineHeight: 22, color: c.dispute, fontWeight: '700' }}>“</Text>
          <Text textBreakStrategy="simple" style={{ flex: 1, fontFamily: SERIF_HINDI, fontSize: 14, lineHeight: 21, color: c.dispute }}>
            {dispute}
          </Text>
        </View>
      ) : null}

      {/* 3. Checklist: चलानी प्रेषित → नोटिस प्राप्त → तामील */}
      <KaryvahiChecklistRows itemId={item.id} json={item.checklist_json} scheme={scheme} onPrashit={setPrashit} />

      {/* 4. Footer: date + section badge */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.divider,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} color={c.muted} />
          <Text style={{ fontSize: 12.5, color: c.muted }}>{dateStr}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <View style={{ backgroundColor: c.badgeBg, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 1 }}>
            <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: c.badgeFg }}>{sections[0]}</Text>
          </View>
          {sections.length > 1 ? (
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.muted }}>+{sections.length - 1}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Date filter "से – तक" (owner) ─────────────────────────────────────────
function shortDate(s: string | null | undefined, withYear: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}${withYear ? ` ${m[1]}` : ''}` : '';
}
function rangeChipLabel(from: string | null | undefined, to: string | null | undefined): string | null {
  if (from && to) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return `${shortDate(a, a.slice(0, 4) !== b.slice(0, 4))} – ${shortDate(b, true)}`;
  }
  if (from) return `${shortDate(from, true)} से`;
  if (to) return `${shortDate(to, true)} तक`;
  return null;
}
function DateRangeBoxes({ draft, setDraft, scheme }: {
  draft: FilterValues; setDraft: (v: FilterValues) => void; scheme: 'light' | 'dark';
}) {
  const P = THEME[scheme];
  const [pick, setPick] = useState<'from' | 'to' | null>(null);
  const box = (which: 'from' | 'to', label: string) => {
    const v = draft[which];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
    return (
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: P.mutedForeground, marginBottom: 4 }}>{label}</Text>
        <Pressable
          onPress={() => setPick(which)}
          accessibilityRole="button"
          accessibilityLabel={`${label} तारीख`}
          style={{
            height: 44, borderRadius: 10, borderWidth: 1, borderColor: m ? MODULE_COLOR : P.border, backgroundColor: P.background,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12,
          }}
        >
          <Text style={{ fontSize: 14, color: m ? P.foreground : P.mutedForeground }}>{m ? `${m[3]}.${m[2]}.${m[1]}` : 'तारीख चुनें'}</Text>
          {m ? (
            <Pressable onPress={() => setDraft({ ...draft, [which]: null })} hitSlop={8} accessibilityLabel={`${label} हटाएँ`}>
              <X size={15} color={P.mutedForeground} />
            </Pressable>
          ) : <CalendarDays size={16} color={P.mutedForeground} />}
        </Pressable>
      </View>
    );
  };
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {box('from', 'से')}
        {box('to', 'तक')}
      </View>
      <Text style={{ fontSize: 11.5, color: P.mutedForeground, marginTop: 6 }}>
        सिर्फ़ &quot;से&quot; भरें = उस दिन से आज तक · सिर्फ़ &quot;तक&quot; भरें = उस दिन तक की सभी
      </Text>
      <DatePickerModal
        visible={pick != null}
        value={(pick && draft[pick]) || ''}
        label={pick === 'to' ? 'तक — तारीख' : 'से — तारीख'}
        accentColor={MODULE_COLOR}
        onConfirm={(v) => { if (pick) setDraft({ ...draft, [pick]: v }); setPick(null); }}
        onClose={() => setPick(null)}
      />
    </View>
  );
}

// ─── Checklist rows on the card ───────────────────────────────────────────
function KaryvahiChecklistRows({ itemId, json, scheme, onPrashit }: {
  itemId: string; json?: string; scheme: 'light' | 'dark'; onPrashit?: (on: boolean) => void;
}) {
  const [ticks, setTicks] = useState<KaryvahiChecklist>(() => parseKaryvahiChecklist(json));
  useEffect(() => { setTicks(parseKaryvahiChecklist(json)); }, [json]);
  const c = CARD_COLORS[scheme];
  const green = scheme === 'dark' ? '#4ADE80' : '#15803D';

  const toggle = (key: keyof KaryvahiChecklist) => {
    const next = { ...ticks, [key]: !ticks[key] };
    setTicks(next);
    onPrashit?.(!!next.prashit);
    setKaryvahiChecklist(itemId, next).catch(() => { setTicks(ticks); onPrashit?.(!!ticks.prashit); });
  };

  const amber = scheme === 'dark' ? '#FBBF24' : '#B45309';
  // Ticks stay hidden until the "चेकलिस्ट n/3" button is pressed (closed again on every visit).
  const [open, setOpen] = useState(false);
  const done = KARYVAHI_CHECKLIST.filter((r) => ticks[r.key]).length;
  const all = done === KARYVAHI_CHECKLIST.length;
  const btnColor = all ? green : c.muted;
  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  return (
    <View style={{ marginTop: 14, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {!ticks.prashit ? (
          // Pending until "चलानी प्रेषित की जा चुकी है" is ticked (also in सूचनाएँ + daily 9 AM alert).
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: `${amber}1F`, borderWidth: 1, borderColor: `${amber}55` }}>
            <Clock size={12} color={amber} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: amber }}>चलानी प्रेषण लंबित</Text>
          </View>
        ) : <View />}
        <Pressable
          onPress={toggleOpen}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`चेकलिस्ट ${done}/${KARYVAHI_CHECKLIST.length}`}
          className="active:opacity-60"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
            borderWidth: 1, borderColor: all ? `${green}66` : c.border, backgroundColor: all ? `${green}14` : 'transparent',
          }}
        >
          {all ? <Check size={13} color={green} strokeWidth={3} /> : null}
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: btnColor }}>चेकलिस्ट {done}/{KARYVAHI_CHECKLIST.length}</Text>
          {open ? <ChevronUp size={15} color={btnColor} /> : <ChevronDown size={15} color={btnColor} />}
        </Pressable>
      </View>
      {open && KARYVAHI_CHECKLIST.map((row) => {
        const on = !!ticks[row.key];
        return (
          <Pressable
            key={row.key}
            onPress={() => toggle(row.key)}
            hitSlop={4}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={row.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
              borderColor: on ? green : c.muted, backgroundColor: on ? green : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 13.5, color: on ? green : c.muted, fontWeight: on ? '600' : '400' }}>
              {row.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function NirodhatmakHomeScreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const listPaddingBottom = useListBottomPadding();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [records, setRecords] = useState<NirodhatmakKaryvahi[]>([]);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<NirodhatmakType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Design C (owner): प्रकार filters in the DB query as before; तारीख / स्थिति on the loaded list.
  const [extraFilters, setExtraFilters] = useState<{ date?: string | null; status?: string | null; from?: string | null; to?: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NirodhatmakKaryvahi | null>(null);
  // Press-and-hold selection (batch Word export / batch delete in the header).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const selecting = selectedIds.size > 0;
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const [longPressTarget, setLongPressTarget] = useState<{ item: NirodhatmakKaryvahi; anchor: MenuAnchor } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (q = query, type = activeType) => {
    try {
      const results = q.trim() || type
        ? await searchNirodhatmakKaryvahi(q, type)
        : await getAllNirodhatmakKaryvahi();
      setRecords(results);
    } catch (e) {
      logger.warn('[Nirodhatmak] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // BUG-C2b FIX: useFocusEffect must NOT depend on query/activeType.
  // Same pattern as gd/index.tsx — every keystroke changed query → new
  // loadData ref → useFocusEffect re-registered → double DB load per keystroke.
  const queryRef = useRef(query);
  const activeTypeRef = useRef(activeType);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeTypeRef.current = activeType; }, [activeType]);

  const firstLoadRef = useRef(true);
  useFocusEffect(useCallback(() => {
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    loadData(queryRef.current, activeTypeRef.current);
  }, [loadData]));

  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedIdsRef.current.size > 0) { setSelectedIds(new Set()); return true; }
      router.replace('/(app)/home' as never);
      return true;
    });
    return () => sub.remove();
  }, []));

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadData(text, activeType), 300);
  };

  const handleTypeFilter = (type: NirodhatmakType | null) => {
    setActiveType(type);
    setShowFilters(false);
    loadData(query, type);
  };

  // ── Filters (design C sheet) ────────────────────────────────────────────
  const filterGroups = useMemo<FilterGroupDef[]>(() => [
    {
      key: 'type', label: t('filter.type', 'प्रकार'),
      options: NIRODHATMAK_TYPES.map((v) => ({ value: v, label: NIRODHATMAK_TYPE_KEYS[v] ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[v]) : v })),
    },
    {
      key: 'date', label: t('filter.date', 'तारीख'),
      options: [{ value: 'today', label: 'आज' }, { value: 'week', label: 'इस हफ़्ते' }, { value: 'month', label: 'इस महीने' },
        { value: 'range', label: '📅 तारीख चुनें' }],
      chipLabel: (v) => (v.date === 'range' ? rangeChipLabel(v.from, v.to) : null),
    },
    {
      key: 'status', label: t('filter.status', 'स्थिति'),
      options: [{ value: 'pending', label: 'चलानी लंबित' }, { value: 'incomplete', label: 'चेकलिस्ट अधूरी' }, { value: 'done', label: 'पूरी' }],
    },
  ], [t]);
  const filterValues = useMemo<FilterValues>(
    () => ({ type: activeType, date: extraFilters.date ?? null, status: extraFilters.status ?? null,
      from: extraFilters.from ?? null, to: extraFilters.to ?? null }),
    [activeType, extraFilters],
  );
  const shownRecords = useMemo(
    () => records.filter((r) => nkMatchesFilters(r, extraFilters)),
    [records, extraFilters],
  );
  // "लागू करें (n)": the type part needs a DB query, so the count is shown only when the type is unchanged.
  const previewCount = useCallback((v: FilterValues): number => (
    (v.type ?? null) === activeType
      ? records.filter((r) => nkMatchesFilters(r, { date: v.date, status: v.status, from: v.from, to: v.to })).length
      : NaN
  ), [records, activeType]);
  const applyFilters = (v: FilterValues) => {
    // "तारीख चुनें" with neither से nor तक = no date filter
    const range = v.date === 'range';
    const empty = range && !v.from && !v.to;
    setExtraFilters({
      date: empty ? null : (v.date ?? null), status: v.status ?? null,
      from: range && !empty ? (v.from ?? null) : null, to: range && !empty ? (v.to ?? null) : null,
    });
    const type = (v.type ?? null) as NirodhatmakType | null;
    if (type !== activeType) handleTypeFilter(type);
  };
  const removeFilter = (key: string) => {
    if (key === 'type') handleTypeFilter(null);
    else if (key === 'date') setExtraFilters((f) => ({ ...f, date: null, from: null, to: null }));
    else setExtraFilters((f) => ({ ...f, [key]: null }));
  };

  const handleBatchDelete = useCallback(async () => {
    const ids = [...selectedIds];
    for (const id of ids) {
      try { await deleteNirodhatmakKaryvahi(id); } catch { /* keep going */ }
    }
    setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setBatchDeleteOpen(false);
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBatchExport = useCallback(() => {
    const items = records.filter((r) => selectedIds.has(r.id));
    exportKaryvahisDocx(items).finally(() => setSelectedIds(new Set()));
  }, [records, selectedIds]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteNirodhatmakKaryvahi(deleteTarget.id);
    setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  // HOOKS RULE FIX: hoisted from renderItem={useCallback(...)} inside the
  // loading ternary. Calling a hook inside a conditional JSX branch violates
  // Rules of Hooks and causes "Rendered more hooks than during the previous render".
  const renderKaryvahiItem = useCallback(({ item }: { item: NirodhatmakKaryvahi }) => (
    <View>
      <KaryvahiCard
        item={item}
        query={query}
        scheme={scheme}
        selecting={selecting}
        selected={selectedIds.has(item.id)}
        onPress={() => {
          if (selecting) { toggleSelected(item.id); return; }
          setLongPressTarget(null);
          router.push(`/(app)/nirodhatmak/add-proceeding?editId=${item.id}` as never);
        }}
        onLongPress={() => { setLongPressTarget(null); toggleSelected(item.id); }}
        onMenu={(anchor) => setLongPressTarget({ item, anchor })}
      />
    </View>
  ), [query, scheme, selecting, selectedIds, toggleSelected]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {longPressTarget ? (
        <ActionMenu
          anchor={longPressTarget.anchor}
          scheme={scheme}
          onEdit={() => {
            const id = longPressTarget.item.id;
            setLongPressTarget(null);
            router.push(`/(app)/nirodhatmak/add-proceeding?editId=${id}` as never);
          }}
          onExport={() => { const it = longPressTarget.item; setLongPressTarget(null); exportKaryvahiDocx(it); }}
          onDelete={() => { const it = longPressTarget.item; setLongPressTarget(null); setDeleteTarget(it); }}
          onClose={() => setLongPressTarget(null)}
        />
      ) : null}
      {selecting ? (
        <AppHeader
          title={`${selectedIds.size} चुनी गईं`}
          subtitle="दबाकर रखें / tap करें: चुनें"
          onBack={clearSelection}
          actions={
            <>
              <HeaderIconBtn
                icon={CheckCheck}
                onPress={() => setSelectedIds(
                  selectedIds.size === shownRecords.length ? new Set() : new Set(shownRecords.map((r) => r.id)),
                )}
                label={selectedIds.size === shownRecords.length ? 'सभी हटाएँ (चयन)' : 'सभी चुनें'}
              />
              <HeaderIconBtn icon={FileDown} onPress={handleBatchExport} label="चुनी गई कार्यवाहियाँ Word में export करें" />
              <HeaderIconBtn icon={Trash2} onPress={() => setBatchDeleteOpen(true)} label="चुनी गई कार्यवाहियाँ हटाएं" color={MODULE_COLOR} />
            </>
          }
        />
      ) : (
        <AppHeader
          title={t('nirodhatmak.list.title')}
          subtitle={loading ? t('common.loading') : t('nirodhatmak.list.proceedingCount', { count: shownRecords.length })}
          onMenuPress={() => setDrawerOpen(true)}
          actions={
            <HeaderIconBtn
              icon={Plus}
              onPress={() => router.push('/(app)/nirodhatmak/add-proceeding' as never)}
              label={t('nirodhatmak.list.addProceeding')}
              color={MODULE_COLOR}
            />
          }
        />
      )}

      {/* Toolbar — design C: ⚙︎ inside the search box, chosen filters as chips, sheet from the bottom */}
      <View className="px-4 pt-3 pb-2 gap-2 bg-background border-b border-border">
        <SearchBar
          value={query}
          noResults={!loading && !!query.trim() && shownRecords.length === 0}
          onChangeText={handleSearch}
          placeholder={t('nirodhatmak.list.searchPlaceholder')}
          variant="light"
          accessibilityLabel={t('nirodhatmak.list.searchAccessibility')}
          trailing={<FilterSearchButton count={activeFilterCount(filterValues, filterGroups)} onPress={() => setShowFilters(true)} accent={MODULE_COLOR} />}
        />
        <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={removeFilter} accent={MODULE_COLOR} />
      </View>
      <FilterSheet
        visible={showFilters}
        groups={filterGroups}
        values={filterValues}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        accent={MODULE_COLOR}
        previewCount={previewCount}
        renderExtra={(key, draft, setDraft) => (key === 'date' && draft.date === 'range'
          ? <DateRangeBoxes draft={draft} setDraft={setDraft} scheme={scheme} /> : null)}
      />

      {/* ── List ───────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={MODULE_COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          data={shownRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          contentContainerClassName="px-6 py-4 gap-3"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(query, activeType); }}
          renderItem={renderKaryvahiItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${MODULE_COLOR}12` }}
              >
                <FileWarning size={30} color={MODULE_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeType
                  ? t('nirodhatmak.list.noProceedingsFound')
                  : t('nirodhatmak.list.noProceedingsYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeType
                  ? t('nirodhatmak.list.noProceedingsFoundHint')
                  : t('nirodhatmak.list.noProceedingsYetHint')}
              </Text>
            </View>
          }
        />
      )}



      {/* ── Batch delete confirmation ───────────────────────────── */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={(v) => { if (!v) setBatchDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`${selectedIds.size} कार्यवाहियाँ हटाएं?`}</AlertDialogTitle>
            <AlertDialogDescription>चुनी गई सभी कार्यवाहियाँ हट जाएँगी।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setBatchDeleteOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleBatchDelete} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('common.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nirodhatmak.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nirodhatmak.dialog.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('common.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
