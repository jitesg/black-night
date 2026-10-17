import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const days = daysUntilDeadline(pp.deadline_date, pp.status);
  if (pp.status === 'Nistarit') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#D1FAE5' }}>
        <CheckCircle size={13} color="#065F46" />
        <Text className="text-xs font-semibold" style={{ color: '#065F46' }}>{t('prarthnaPatra.status.nistarit')}</Text>
      </View>
    );
  }
  if (pp.status === 'Finished') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#EDE9FE' }}>
        <CheckCircle size={13} color="#5B21B6" />
        <Text className="text-xs font-semibold" style={{ color: '#5B21B6' }}>{t('fir.list.filterFinished')}</Text>
      </View>
    );
  }
  if (days <= 0) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#FEE2E2' }}>
        <AlertCircle size={13} color="#991B1B" />
        <Text className="text-xs font-semibold" style={{ color: '#991B1B' }}>{t('prarthnaPatra.filters.overdue')}</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: '#FEF3C7' }}>
      <Clock size={13} color="#92400E" />
      <Text className="text-xs font-semibold" style={{ color: '#92400E' }}>{t('fir.list.filterPending')}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function PPDetailScreen() {
  const { t } = useTranslation();
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
        <Text className="text-base font-semibold text-muted-foreground">{t('prarthnaPatra.detail.notFound')}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-70">
          <Text className="text-sm text-primary">{t('prarthnaPatra.detail.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const days = daysUntilDeadline(pp.deadline_date, pp.status);
  const dayLabel = (pp.status === 'Nistarit' || pp.status === 'Finished')
    ? null
    : days > 0 ? t('prarthnaPatra.dayLabel.remaining', { count: days })
    : days === 0 ? t('prarthnaPatra.dayLabel.dueToday')
    : t('prarthnaPatra.dayLabel.overdue', { count: Math.abs(days) });
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
        <SectionHeader title={t('prarthnaPatra.detail.sectionPetitionDetails')} />
        <View
          className="bg-card border border-border rounded-2xl p-4"
          style={{ borderCurve: 'continuous' }}
        >
          <InfoRow label={t('prarthnaPatra.detail.regNo')} value={pp.registration_number} />
          <InfoRow label={t('prarthnaPatra.detail.petitionType')} value={PETITION_TYPE_LABELS[pp.petition_type]} />
          <InfoRow label={t('prarthnaPatra.detail.dateOfReceipt')} value={pp.date_of_receipt} />
          <InfoRow label={t('prarthnaPatra.detail.deadlineDate')} value={pp.deadline_date} />
          <InfoRow label={t('prarthnaPatra.detail.investigator')} value={pp.investigator_name} />
          {pp.disposal_date && <InfoRow label={t('prarthnaPatra.detail.disposalDate')} value={pp.disposal_date} />}
        </View>

        {/* ── Complainants ── */}
        <SectionHeader title={t('prarthnaPatra.detail.sectionComplainants', { count: pp.complainants.length })} />
        {pp.complainants.map((c, i) => (
          <View
            key={c.id}
            className="bg-card border border-border rounded-2xl p-4 mb-3"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <User size={14} color="#6B7280" />
              <Text className="text-sm font-semibold text-foreground">
                {t('prarthnaPatra.detail.complainantCardTitle', { number: i + 1 })}
              </Text>
            </View>
            <InfoRow label={t('prarthnaPatra.detail.name')} value={c.name} />
            <InfoRow label={t('prarthnaPatra.detail.fatherHusband')} value={c.father_husband_name} />
            <InfoRow label={t('prarthnaPatra.detail.mobile')} value={c.mobile} />
            <InfoRow label={t('prarthnaPatra.detail.altMobile')} value={c.alternate_mobile} />
            <InfoRow label={t('prarthnaPatra.detail.address')} value={c.full_address} />
            <InfoRow label={t('prarthnaPatra.detail.village')} value={c.village} />
            <InfoRow label={t('prarthnaPatra.detail.policeStation')} value={c.police_station} />
            <InfoRow label={t('prarthnaPatra.detail.district')} value={c.district} />
            <InfoRow label={t('prarthnaPatra.detail.ageGender')} value={[c.age, c.gender].filter(Boolean).join(' / ')} />
            <InfoRow label={t('prarthnaPatra.detail.caste')} value={c.jati} />
          </View>
        ))}

        {/* ── Matter ── */}
        {pp.matter ? (
          <>
            <SectionHeader title={t('prarthnaPatra.detail.sectionMatter')} />
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
            <SectionHeader title={t('prarthnaPatra.detail.sectionAccused', { count: pp.accused.length })} />
            {pp.accused.map((a, i) => (
              <View
                key={a.id}
                className="bg-card border border-border rounded-2xl p-4 mb-3"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <Users size={14} color="#6B7280" />
                  <Text className="text-sm font-semibold text-foreground">
                    {t('prarthnaPatra.detail.accusedCardTitle', { number: i + 1 })}
                  </Text>
                </View>
                <InfoRow label={t('prarthnaPatra.detail.name')} value={a.name} />
                <InfoRow label={t('prarthnaPatra.detail.fatherName')} value={a.father_name} />
                <InfoRow label={t('prarthnaPatra.detail.mobile')} value={a.mobile} />
                <InfoRow label={t('prarthnaPatra.detail.altMobile')} value={a.alternate_mobile} />
                <InfoRow label={t('prarthnaPatra.detail.address')} value={a.full_address} />
                <InfoRow label={t('prarthnaPatra.detail.village')} value={a.village} />
                <InfoRow label={t('prarthnaPatra.detail.policeStation')} value={a.police_station} />
                <InfoRow label={t('prarthnaPatra.detail.district')} value={a.district} />
                <InfoRow label={t('prarthnaPatra.detail.casteAgeGender')} value={[a.jati, a.age, a.gender].filter(Boolean).join(' / ')} />
                <InfoRow label={t('prarthnaPatra.detail.remarks')} value={a.remarks} />
              </View>
            ))}
          </>
        )}

        {/* ── Report section ── */}
        {pp.report && (
          <>
            <SectionHeader title={t('prarthnaPatra.detail.sectionReport')} />
            <View
              className="bg-card border border-border rounded-2xl p-4"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-xs text-muted-foreground">
                  {t('prarthnaPatra.detail.reportDate', { date: pp.report.report_preparation_date })}
                </Text>
              </View>
              <Text className="text-sm text-foreground leading-6">{stripHtmlTags(pp.report.report_content)}</Text>
            </View>
          </>
        )}

        {/* ── Actions section (Beat / NCR) ── */}
        {useActionFlow && pp.actions.length > 0 && (
          <>
            <SectionHeader title={t('prarthnaPatra.detail.sectionActions', { count: pp.actions.length })} />
            {pp.actions.map((action) => (
              <View
                key={action.id}
                className="bg-card border border-border rounded-2xl p-4 mb-3"
                style={{ borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Zap size={14} color="#7C3AED" />
                  <Text className="text-xs text-muted-foreground">
                    {t('prarthnaPatra.detail.actionDate', { date: action.action_date })}
                  </Text>
                  {action.action_type ? (
                    <View className="rounded-full px-2 py-0.5 bg-secondary ml-auto">
                      <Text className="text-xs text-muted-foreground">{action.action_type}</Text>
                    </View>
                  ) : null}
                </View>
                {action.format_title ? (
                  <Text className="text-xs text-muted-foreground mb-1">
                    {t('prarthnaPatra.detail.actionFormat', { title: action.format_title })}
                  </Text>
                ) : null}
                <Text className="text-sm text-foreground leading-6">{stripHtmlTags(action.action_content)}</Text>
                <View className="mt-2 self-start rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: action.is_complete ? '#EDE9FE' : '#FEF3C7' }}>
                  <Text className="text-xs font-semibold"
                    style={{ color: action.is_complete ? '#5B21B6' : '#92400E' }}>
                    {action.is_complete ? t('fir.list.filterFinished') : t('fir.list.filterPending')}
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
                <Zap size={15} color="#fff" /> {t('prarthnaPatra.detail.takeActionBtn')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push(`/(app)/prarthna-patra/${pp.id}/report` as never)}
              className="rounded-xl py-3.5 items-center active:opacity-70"
              style={{ backgroundColor: pp.status === 'Pending' ? '#2D52B8' : '#059669' }}
            >
              <Text className="text-sm font-semibold text-white">
                {pp.status === 'Pending' ? t('prarthnaPatra.detail.addReportBtn') : t('prarthnaPatra.detail.viewEditReportBtn')}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
