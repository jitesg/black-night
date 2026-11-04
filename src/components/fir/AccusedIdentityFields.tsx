/**
 * FIR अभियुक्त — सम्बन्ध (पुत्र / पुत्री / पत्नी), पिता / पति का नाम, लिंग (owner: same as the वादी card).
 * Used by mukadma/add-fir and the FIR details tab. These values fill the formats (@FIR.accused_*).
 */
import { Pressable, Text, View } from 'react-native';
import { Input } from '@/components/ui/input';

export interface AccusedIdentity { relation: string; father: string; gender: string }

const RELATIONS = ['पुत्र', 'पुत्री', 'पत्नी'];
const GENDERS = ['पुरुष', 'महिला'];

function Chips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onPick(on ? '' : o)}
            className="rounded-full border px-3 py-1.5"
            style={{ borderColor: on ? '#6366F1' : '#E5E7EB', backgroundColor: on ? '#EEF2FF' : '#fff' }}
          >
            <Text className="text-xs font-medium" style={{ color: on ? '#6366F1' : '#6B7280' }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="text-xs font-semibold text-muted-foreground">{children}</Text>;
}

export function AccusedIdentityFields({
  value, onChange,
}: { value: AccusedIdentity; onChange: (field: keyof AccusedIdentity, v: string) => void }) {
  // पत्नी → महिला; a woman picked first → पुत्री / पत्नी stays the officer's choice
  const pickRelation = (v: string) => {
    onChange('relation', v);
    if (v === 'पत्नी' || v === 'पुत्री') onChange('gender', 'महिला');
    else if (v === 'पुत्र') onChange('gender', 'पुरुष');
  };
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>सम्बन्ध</Label>
        <Chips options={RELATIONS} value={value.relation} onPick={pickRelation} />
      </View>
      <View className="gap-1.5">
        <Label>पिता / पति का नाम</Label>
        <Input clearCopy value={value.father} onChangeText={(v) => onChange('father', v)} placeholder="जैसे: रामलाल" />
      </View>
      <View className="gap-1.5">
        <Label>लिंग</Label>
        <Chips options={GENDERS} value={value.gender} onPick={(v) => onChange('gender', v)} />
      </View>
    </View>
  );
}
