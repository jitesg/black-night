/**
 * "वर्कस्पेस से स्वतः भरा गया" pills — थाना / जनपद / अधिकारी का नाम (and, on न्यायालय, values from the कागज़) that a format fills
 * by itself. One shared component for the fill screens (owner: the same thing looked different — ✏️ only on the direct प्रारूप
 * screen). Each pill is editable: an edit goes into the report only; the workspace setting is never changed here.
 * Look = the pill formats/fill.tsx already had (THEME colours, light + dark).
 */
import { memo } from 'react';
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

interface Props {
  /** Heading above the pills (i18n text from the screen). */
  title: string;
  /** key → current value (only keys that were filled by themselves). */
  values: Record<string, string>;
  /** key → label when there is no Hindi name above. */
  fallbackLabels?: Readonly<Record<string, string>>;
  /** A pill was edited — the screen puts the value into its form values. */
  onChange: (key: string, value: string) => void;
}

export const AutoValuePills = memo(function AutoValuePills({ title, values, fallbackLabels, onChange }: Props) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const keys = Object.keys(values);
  if (!keys.length) return null;
  return (
    <View className="gap-2">
      <Text style={{ fontSize: 11, color: C.mutedForeground, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {keys.map((k) => (
          <View
            key={k}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
              backgroundColor: C.secondary,
              borderWidth: 0.5, borderColor: C.border,
            }}
          >
            <CheckCircle2 size={11} color="#4ADE80" />
            <Text style={{ fontSize: 12, color: C.foreground, fontWeight: '500' }}>
              {AUTO_PILL_LABELS_HI[k] ?? fallbackLabels?.[k] ?? k}:
            </Text>
            <TextInput
              value={values[k]}
              onChangeText={(v) => onChange(k, v)}
              accessibilityLabel={`${AUTO_PILL_LABELS_HI[k] ?? fallbackLabels?.[k] ?? k} बदलें`}
              style={[
                {
                  fontSize: 12,
                  color: C.foreground,
                  minWidth: 60,
                  // Hindi needs vertical room: zero padding clipped the lower part of letters (बछरावा, रायबरेली) on Android.
                  paddingHorizontal: 0,
                  paddingTop: 2,
                  paddingBottom: 3,
                  minHeight: 26,
                  textAlignVertical: 'center',
                  includeFontPadding: true,
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                },
                Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as never) : {},
              ]}
            />
            <Pencil size={10} color={C.mutedForeground} />
          </View>
        ))}
      </View>
    </View>
  );
});
