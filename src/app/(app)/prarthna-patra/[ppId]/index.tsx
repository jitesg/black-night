import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { stripHtmlTags } from '@/lib/stringUtils';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pencil, Calendar, Clock, CheckCircle, AlertCircle, User, Users, Zap,
} from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import {
  getPPWithDetails,
  daysUntilDeadline,
  PETITION_TYPE_LABELS,
  isActionWorkflow,
  type PPWithDetails,
} from '@/lib/db/prarthnaPatraRepo';

// ── Helpers ───────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-2 mb-2">
      <Text className="text-xs text-muted-foreground font-medium w-32">{label}</Text>
      <Text className="text-xs text-foreground flex-1">{value}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mt-6 mb-3">
      {title}
    </Text>
  );
}

function StatusChip({ pp }: { pp: PPWithDetails }) {
  const days = daysUntilDeadline(pp.deadline_date, pp.status);
  if (pp.status === 'Nistarit') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#D1FAE5' }}>
        <CheckCircle size={13} color="#065F46" />
        <Text className="text-xs font-semibold" style={{ color: '#065F46' }}>Nistarit</Text>
      </View>
    );
  }
  if (pp.status === 'Finished') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#EDE9FE' }}>
        <CheckCircle size={13} color="#5B21B6" />
        <Text className="text-xs font-semibold" style={{ color: '#5B21B6' }}>Finished</Text>
      </View>
    );
  }
  if (days <= 0) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#FEE2E2' }}>
        <AlertCircle size={13} color="#991B1B" />
        <Text className="text-xs font-semibold" style={{ color: '#991B1B' }}>Overdue</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#FEF3C7' }}>
      <Clock size={13} color="#92400E" />
      <Text className="text-xs font-semibold" style={{ color: '#92400E' }}>Pending</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function PPDetailScreen() {
  const { ppId } = useLocalSearchParams<{ ppId: string }>();
  const [pp, setPP] = useState<PPWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      try {
        const data = ppId ? await getPPWithDetails(ppId) : null;
        setPP(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [ppId]));

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!pp) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-base font-semibold text-muted-foreground">Petition not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-70">
          <Text className="text-sm text-primary">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const days = daysUntilDeadline(pp.deadline_date, pp.status);
  const dayLabel = (pp.status === 'Nistarit' || pp.status === 'Finished')
    ? null
    : days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining`
    : days === 0 ? 'Due today'
    : `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  const dayColor = (pp.status === 'Nistarit' || pp.status === 'Finished') ? '#6B7280'
    : days > 0 ? '#2D52B8' : '#DC2626';

  const useActionFlow = isActionWorkflow(pp.petition_type);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={PETITION_TYPE_LABELS[pp.petition_type]}
        subtitle={pp.registration_number}
        onBack={() => router.back()}
        variant="navy"
        rightActions={
          <Pressable
            onPress={() => router.push(`/(app)/prarthna-patra/add?editId=${pp.id}` as never)}
            className="w-9 h-9 rounded-xl items-center justify-center active:opacity-70"
            style={{ backgroundColor: '#ffffff18' }}
          >
            <Pencil size={17} color="#fff" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-5 pb-10"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ── Status banner ── */}
        <View
          className="border border-border rounded-2xl p-4 mt-4 flex-row items-center gap-3"
          style={{ borderCurve: 'continuous' }}
        >
          <StatusChip pp={pp} />
          {dayLabel && (
            <Text className="text-sm font-semibold flex-1 text-right" style={{ color: dayColor }}>
              {dayLabel}
            </Text>
          )}
        </View>

        {/* ── Petition info ── */}
        <SectionHeader title="Petition Details" />
        <View
          className="bg-card border border-border rounded-2xl p-4"
          style={{ borderCurve: 'continuous' }}
        >
          <InfoRow label="Registration No." value={pp.registration_number} />
          <InfoRow label="Petition Type" value={PETITION_TYPE_LABELS[pp.petition_type]} />
          <InfoRow label="Date of Receipt" value={pp.date_of_receipt} />
          <InfoRow label="Deadline Date" value={pp.deadline_date} />
          <InfoRow label="Investigator" value={pp.investigator_name} />
          {pp.disposal_date && <InfoRow label="Disposal Date" value={pp.disposal_date} />}
        </View>

        {/* ── Complainants ── */}
        <SectionHeader title={`Complainants (${pp.complainants.length})`} />
        {pp.complainants.map((c, i) => (
          <View
            key={c.id}
            className="bg-card border border-border rounded-2xl p-4 mb-3"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <User size={14} color="#6B7280" />
              <Text className="text-sm font-semibold text-foreground">Complainant {i + 1}</Text>
            </View>
            <InfoRow label="Name" value={c.name} />
            <InfoRow label="Father/Husband" value={c.father_husband_name} />
            <InfoRow label="Mobile" value={c.mobile} />
            <InfoRow label="Alt Mobile" value={c.alternate_mobile} />
            <InfoRow label="Address" value={c.full_address} />
            <InfoRow label="Village" value={c.village} />
            <InfoRow label="Police Station" value={c.police_station} />
            <InfoRow label="District" value={c.district} />
            <InfoRow label="Age / Gender" value={[c.age, c.gender].filter(Boolean).join(' / ')} />
            <InfoRow label="जाति" value={c.jati} />
          </View>
        ))}

        {/* ── Matter ── */}
        {pp.matter ? (
          <>
            <SectionHeader title="Matter (विवरण)" />
            <View
              className="bg-card border border-border rounded-2xl p-4"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-sm text-foreground leading-6">{stripHtmlTags(pp.matter)}</Text>
            </View>
          </>
        ) : null}

        {/* ── Accused ── */}
        {pp.accused.length > 0 && (
          <>
            <SectionHeader title={`Accused (${pp.accused.length})`} />
            {pp.accused.map((a, i) => (
              <View
                key={a.id}
                className="bg-card border border-border rounded-2xl p-4 mb-3"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <Users size={14} color="#6B7280" />
                  <Text className="text-sm font-semibold text-foreground">Accused {i + 1}</Text>
                </View>
                <InfoRow label="Name" value={a.name} />
                <InfoRow label="Father Name" value={a.father_name} />
                <InfoRow label="Mobile" value={a.mobile} />
                <InfoRow label="Alt Mobile" value={a.alternate_mobile} />
                <InfoRow label="Address" value={a.full_address} />
                <InfoRow label="Village" value={a.village} />
                <InfoRow label="Police Station" value={a.police_station} />
                <InfoRow label="District" value={a.district} />
                <InfoRow label="जाति / उम्र / लिंग" value={[a.jati, a.age, a.gender].filter(Boolean).join(' / ')} />
                <InfoRow label="Remarks" value={a.remarks} />
              </View>
            ))}
          </>
        )}

        {/* ── Report section ── */}
        {pp.report && (
          <>
            <SectionHeader title="Report" />
            <View
              className="bg-card border border-border rounded-2xl p-4"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-xs text-muted-foreground">
                  Report Date: {pp.report.report_preparation_date}
                </Text>
              </View>
              <Text className="text-sm text-foreground leading-6">{stripHtmlTags(pp.report.report_content)}</Text>
            </View>
          </>
        )}

        {/* ── Actions section (Beat / NCR) ── */}
        {useActionFlow && pp.actions.length > 0 && (
          <>
            <SectionHeader title={`Actions (${pp.actions.length})`} />
            {pp.actions.map((action) => (
              <View
                key={action.id}
                className="bg-card border border-border rounded-2xl p-4 mb-3"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Zap size={14} color="#7C3AED" />
                  <Text className="text-xs text-muted-foreground">Date: {action.action_date}</Text>
                  {action.action_type ? (
                    <View className="rounded-full px-2 py-0.5 bg-secondary ml-auto">
                      <Text className="text-xs text-muted-foreground">{action.action_type}</Text>
                    </View>
                  ) : null}
                </View>
                {action.format_title ? (
                  <Text className="text-xs text-muted-foreground mb-1">
                    Format: {action.format_title}
                  </Text>
                ) : null}
                <Text className="text-sm text-foreground leading-6">{stripHtmlTags(action.action_content)}</Text>
                <View className="mt-2 self-start rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: action.is_complete ? '#EDE9FE' : '#FEF3C7' }}>
                  <Text className="text-xs font-semibold"
                    style={{ color: action.is_complete ? '#5B21B6' : '#92400E' }}>
                    {action.is_complete ? 'Finished' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── CTA ── */}
        <View className="mt-6">
          {useActionFlow ? (
            <Pressable
              onPress={() => router.push(`/(app)/prarthna-patra/${pp.id}/take-action` as never)}
              className="rounded-xl py-3.5 items-center active:opacity-70"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <Text className="text-sm font-semibold text-white">
                <Zap size={15} color="#fff" /> Take Action
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push(`/(app)/prarthna-patra/${pp.id}/report` as never)}
              className="rounded-xl py-3.5 items-center active:opacity-70"
              style={{ backgroundColor: pp.status === 'Pending' ? '#2D52B8' : '#059669' }}
            >
              <Text className="text-sm font-semibold text-white">
                {pp.status === 'Pending' ? 'रिपोर्ट लगाए (Add Report)' : 'View / Edit Report'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
