/**
 * "वर्कस्पेस से स्वतः भरा गया" boxes — अधिकारी का नाम / थाना / जनपद (and, on न्यायालय, values from the कागज़) that a format fills
 * by itself. One shared component for the fill screens (owner: the same thing looked different — ✏️ only on the direct प्रारूप
 * screen). Each box is editable: an edit goes into the report only; the workspace setting is never changed here.
 * THEME colours, light + dark.
 */
import { memo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Pencil } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

/** Hindi names for the pills (owner). Keys not listed fall back to the caller's label, then the key itself. */
export const AUTO_PILL_LABELS_HI: Readonly<Record<string, string>> = {
  PoliceStation: 'थाना',
  District: 'जनपद',
  OfficerName: 'अधिकारी का नाम',
  State: 'राज्य',
  NBW_NO: 'NBW सं0',
  NBW_DATE: 'NBW दिनांक',
  NBW_COURT: 'न्यायालय',
  NBW_EXECUTION_DATE: 'तामील दिनांक',
  SUMMON_NO: 'सम्मन सं0',
  SUMMON_DATE: 'सम्मन दिनांक',
  HEARING_DATE: 'सुनवाई दिनांक',
  COURT_NAME: 'न्यायालय',
  CASE_NO: 'वाद सं0',
  court_name: 'न्यायालय',
  vad_sankhya: 'वाद सं0',
  apradh_sankhya: 'मु0अ0सं0',
  fir_number: 'मु0अ0सं0',
  accused_names: 'अभियुक्त',
};

/** Shown first, in this order (owner): अधिकारी का नाम → थाना → जनपद; other keys after them. */
const FIRST_KEYS = ['OfficerName', 'PoliceStation', 'District', 'State'];

interface Props {
  /** Heading above the boxes (i18n text from the screen). */
  title: string;
  /** key → current value (keys the format fills by itself; '' = the setting is empty). */
  values: Record<string, string>;
  /** key → label when there is no Hindi name above. */
  fallbackLabels?: Readonly<Record<string, string>>;
  /** Keys that must not stay empty (थाना / जनपद / अधिकारी का नाम) — red border + "भरें" while empty. */
  isRequired?: (key: string) => boolean;
  /** A box was edited — the screen puts the value into its form values. */
  onChange: (key: string, value: string) => void;
}

/**
 * Owner's look: one box per line (label above, rectangular box below — like थाना / जनपद on the person card), at the
 * bottom of the form; editable, a required one may not stay empty.
 */
export const AutoValuePills = memo(function AutoValuePills({ title, values, fallbackLabels, isRequired, onChange }: Props) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [focused, setFocused] = useState<string | null>(null);
  const keys = Object.keys(values).sort((a, b) => {
    const ia = FIRST_KEYS.indexOf(a), ib = FIRST_KEYS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  if (!keys.length) return null;
  const labelOf = (k: string) => AUTO_PILL_LABELS_HI[k] ?? fallbackLabels?.[k] ?? k;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <CheckCircle2 size={13} color="#16A34A" />
        <Text style={{ fontSize: 12, color: C.mutedForeground, fontWeight: '500', letterSpacing: 0.4 }}>{title}</Text>
      </View>
      {keys.map((k) => {
        const empty = !(values[k] ?? '').trim();
        const missing = empty && !!isRequired?.(k);
        const borderColor = missing ? C.destructive : focused === k ? C.primary : C.border;
        return (
          <View key={k} style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, color: C.mutedForeground, fontWeight: '500' }}>
              {labelOf(k)}{isRequired?.(k) ? <Text style={{ color: C.destructive }}> *</Text> : null}
            </Text>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                borderWidth: focused === k || missing ? 1.5 : 1, borderColor,
                borderRadius: 10, paddingHorizontal: 12, minHeight: 44,
                backgroundColor: focused === k ? C.card : C.background,
              }}
            >
              <TextInput
                value={values[k]}
                onChangeText={(v) => onChange(k, v)}
                onFocus={() => setFocused(k)}
                onBlur={() => setFocused((f) => (f === k ? null : f))}
                placeholder={missing ? `${labelOf(k)} भरें` : undefined}
                placeholderTextColor={C.mutedForeground}
                accessibilityLabel={`${labelOf(k)} बदलें`}
                style={[
                  // Hindi needs vertical room: zero padding clipped the lower part of letters (बछरावा, रायबरेली) on Android.
                  { flex: 1, fontSize: 15, color: C.foreground, paddingVertical: 9, includeFontPadding: true },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
                ]}
              />
              <Pencil size={13} color={C.mutedForeground} />
            </View>
            {missing ? <Text style={{ fontSize: 11, color: C.destructive }}>यह खाना रिपोर्ट में छपता है — भरना ज़रूरी है</Text> : null}
          </View>
        );
      })}
    </View>
  );
});
