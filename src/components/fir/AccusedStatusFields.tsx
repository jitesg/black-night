/**
 * "⚖️ अभियुक्त की स्थिति" — the part at the bottom of a मुकदमा अभियुक्त group card (owner, sample approved):
 * जमानत स्थिति chips and, while जेल में, रिमांड नंबर / रिमांड की तारीख / अगली रिमांड तारीख.
 * Used by mukadma/add-fir and the FIR details tab through PersonGroupInput `renderCardExtra`.
 * THEME colours (light + dark) — the old chips had hard-coded white / indigo.
 */
import { memo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';

/** YYYY-MM-DD → dd/mm/yyyy (other text shown as it is). */
function showDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

type C = typeof THEME.light;

function Label({ C, text }: { C: C; text: string }) {
  return <Text style={{ fontSize: 12, color: C.mutedForeground, fontWeight: '600', marginBottom: 6 }}>{text}</Text>;
}

function DateBox({ C, label, value, onChange }: { C: C; label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Label C={C} text={label} />
      <Pressable
        onPress={() => setShow(true)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, borderWidth: 1,
          borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: C.background }}
      >
        <Text numberOfLines={1} style={{ fontSize: 14, color: value ? C.foreground : C.mutedForeground }}>{value ? showDate(value) : 'तारीख चुनें'}</Text>
        <ChevronDown size={14} color={C.mutedForeground} />
      </Pressable>
      <DatePickerModal visible={show} value={value} label={label} onConfirm={(v) => { onChange(v); setShow(false); }} onClose={() => setShow(false)} />
    </View>
  );
}

export const AccusedStatusFields = memo(function AccusedStatusFields({ bailStatus, remandNumber, dateOfRemand, nextRemandDate, set }: {
  bailStatus: string; remandNumber: string; dateOfRemand: string; nextRemandDate: string;
  set: (field: 'bailStatus' | 'remandNumber' | 'dateOfRemand' | 'nextRemandDate', value: string) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const accent = dark ? '#F87171' : '#DC2626';
  const options = [
    { value: 'unknown', label: t('fir.addFir.bailUnknown') },
    { value: 'in_jail', label: t('fir.addFir.bailInJail') },
    { value: 'on_bail', label: t('fir.addFir.bailOnBail') },
  ];
  const status = bailStatus || 'unknown';
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, gap: 12 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '800', color: accent }}>⚖️ अभियुक्त की स्थिति</Text>
      <View>
        <Label C={C} text={t('fir.addFir.fieldBailStatus')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((o) => {
            const on = status === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => set('bailStatus', o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 6,
                  borderColor: on ? C.primary : C.border, backgroundColor: on ? C.accent : C.card }}
              >
                <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? C.primary : C.foreground }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {status === 'in_jail' ? (
        <>
          <View>
            <Label C={C} text={t('fir.addFir.fieldRemandNumber')} />
            <TextInput
              value={remandNumber}
              onChangeText={(v) => set('remandNumber', v)}
              placeholder={t('fir.addFir.fieldRemandNumber')}
              placeholderTextColor={C.mutedForeground}
              style={{ minHeight: 42, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14,
                color: C.foreground, backgroundColor: C.background }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateBox C={C} label={t('fir.addFir.fieldDateOfRemand')} value={dateOfRemand} onChange={(v) => set('dateOfRemand', v)} />
            <DateBox C={C} label={t('fir.addFir.fieldNextRemandDate')} value={nextRemandDate} onChange={(v) => set('nextRemandDate', v)} />
          </View>
          {nextRemandDate ? (
            <Text style={{ fontSize: 12, color: dark ? '#FCD34D' : '#B45309' }}>{`⏰ ${t('fir.nextRemandPrefix')}: ${showDate(nextRemandDate)}`}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
});
