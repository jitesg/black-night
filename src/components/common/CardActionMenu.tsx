/**
 * Card ⋮ button + small floating menu (owner, list card design B — न्यायालय + प्रार्थना पत्र):
 * देखें / संपादित करें / हटाएँ, opened from ⋮ or by pressing and holding the card (`useCardMenu().openAt`).
 * Same look as the निरोधात्मक card menu: popup at the button, opens upwards near the bottom. THEME colours, light + dark.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { Edit2, Eye, MoreVertical, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

type Anchor = { x: number; y: number; w: number; h: number };
const MENU_W = 196;
const ROW_H = 44;

/** Holds the ⋮ ref + where the menu opens. `openAt()` measures the ⋮ button (also used by the card's long press). */
export function useCardMenu() {
  const btnRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openAt = useCallback(() => {
    btnRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }, []);
  const close = useCallback(() => setAnchor(null), []);
  return { btnRef, anchor, openAt, close };
}

/** The ⋮ button itself (32 × 32, muted icon). */
export function CardMenuButton({ btnRef, onPress }: { btnRef: React.RefObject<View | null>; onPress: () => void }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <Pressable
      ref={btnRef}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="और विकल्प"
      style={{ width: 32, height: 32, marginRight: -8, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
      className="active:opacity-50"
    >
      <MoreVertical size={20} color={C.mutedForeground} />
    </Pressable>
  );
}

/** The popup: देखें / संपादित करें / हटाएँ. Each choice closes the menu first. */
export function CardActionMenu({ anchor, onClose, onView, onEdit, onDelete }: {
  anchor: Anchor | null;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  if (!anchor) return null;
  const { width: sw, height: sh } = Dimensions.get('window');
  const menuH = ROW_H * 3 + 8;
  // Right edge under the ⋮ button; opens upwards when there is no room below.
  const left = Math.max(8, Math.min(anchor.x + anchor.w - MENU_W, sw - MENU_W - 8));
  const below = anchor.y + anchor.h + 4;
  const top = below + menuH > sh - NAV_BAR_INSET - 8 ? Math.max(8, anchor.y - menuH - 4) : below;
  const row = (icon: React.ReactNode, label: string, run: () => void, danger = false) => (
    <Pressable
      onPress={() => { onClose(); run(); }}
      className="active:opacity-60"
      style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
      accessibilityRole="menuitem"
    >
      {icon}
      <Text style={{ fontSize: 14, color: danger ? C.destructive : C.foreground }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="menu बंद करें">
        <View style={{
          position: 'absolute', left, top, width: MENU_W, paddingVertical: 4, borderRadius: 12,
          backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}>
          {row(<Eye size={16} color={C.foreground} />, 'देखें', onView)}
          {row(<Edit2 size={16} color={C.foreground} />, 'संपादित करें', onEdit)}
          {row(<Trash2 size={16} color={C.destructive} />, 'हटाएँ', onDelete, true)}
        </View>
      </Pressable>
    </Modal>
  );
}

/** "2026-11-26" → "26/11/2026" (owner: dates as dd/mm/yyyy); anything else unchanged. */
export function dmy(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v ?? '');
}
