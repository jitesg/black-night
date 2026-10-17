import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Clock, ClipboardList, Edit2, Share2, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  getChecklistById, getItemsByChecklist, deleteChecklist,
  type InvestigationChecklist, type ChecklistItem,
} from '@/lib/db/checklistRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const COLOR = '#0891B2';

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ChecklistDetailScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { checklistId } = useLocalSearchParams<{ checklistId: string }>();

  const [checklist, setChecklist] = useState<InvestigationChecklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!checklistId) return;
      (async () => {
        setLoading(true);
        const [c, its] = await Promise.all([
          getChecklistById(checklistId),
          getItemsByChecklist(checklistId),
        ]);
        setChecklist(c);
        setItems(its);
        setLoading(false);
      })();
    }, [checklistId])
  );

  const handleShare = async () => {
    if (!checklist) return;
    const crimeLabel = [checklist.crime_type, checklist.crime_subtype].filter(Boolean).join(' › ');
    const lines = [
      checklist.title,
      crimeLabel ? t('knowledge.checklist.shareCrimeType', { crime: crimeLabel }) : '',
      checklist.description ? `\n${checklist.description}` : '',
      '',
      t('knowledge.checklist.shareChecklistItems'),
      ...items.map((it) =>
        `${it.serial_no}. ${it.task_name}${it.brief_description ? `\n   ${it.brief_description}` : ''}`
      ),
    ].filter((l) => l !== undefined);
    try {
      await Share.share({ message: lines.join('\n'), title: checklist.title });
    } catch { /* cancelled */ }
  };

  const handleDeleteConfirm = async () => {
    if (!checklist) return;
    await deleteChecklist(checklist.id);
    setShowDelete(false);
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">{t('common.loading')}</Text>
      </View>
    );
  }

  if (!checklist) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-6">
        <Text className="text-base font-semibold text-foreground">{t('knowledge.checklist.notFound')}</Text>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Text className="text-sm text-primary">{t('knowledge.checklist.goBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const tagList = checklist.tags.split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={checklist.title}
        showBack
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Actions */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() =>
              router.push(
                `/(app)/knowledge/checklists/add-checklist?editId=${checklist.id}` as never
              )
            }
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Edit2 size={14} color={C.mutedForeground} />
            <Text className="text-sm font-medium text-foreground">{t('common.edit')}</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Share2 size={14} color={C.mutedForeground} />
            <Text className="text-sm font-medium text-foreground">{t('common.share')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowDelete(true)}
            className="w-10 items-center justify-center rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Trash2 size={14} color={C.destructive} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-6 py-5 gap-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Badges */}
        <View className="flex-row flex-wrap gap-2">
          {checklist.crime_type ? (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: `${COLOR}15` }}
            >
              <Text className="text-xs font-semibold" style={{ color: COLOR }}>
                {[checklist.crime_type, checklist.crime_subtype].filter(Boolean).join(' › ')}
              </Text>
            </View>
          ) : null}
          <View className="rounded-full px-3 py-1 bg-secondary">
            <Text className="text-xs font-medium text-muted-foreground">
              {t('knowledge.checklist.itemCount', { count: items.length })}
            </Text>
          </View>
        </View>

        {/* Description */}
        {checklist.description ? (
          <View
            className="bg-card border border-border rounded-2xl p-4 gap-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.checklist.description')}
            </Text>
            <Text className="text-base text-foreground leading-7" selectable>
              {checklist.description}
            </Text>
          </View>
        ) : null}

        {/* Tags */}
        {tagList.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {tagList.map((tag, idx) => (
              <View key={`${idx}-${tag}`} className="bg-secondary rounded-full px-3 py-1">
                <Text className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Checklist Items */}
        <View
          className="bg-card border border-border rounded-2xl overflow-hidden"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="px-4 py-3 border-b border-border/60">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.checklist.itemsHeading', { count: items.length })}
            </Text>
          </View>
          {items.length === 0 ? (
            <View className="items-center py-10 gap-2">
              <Text className="text-sm text-muted-foreground">{t('knowledge.checklist.noItemsInChecklist')}</Text>
            </View>
          ) : (
            items.map((it, index) => (
              <View
                key={it.id}
                className="px-4 py-3 flex-row gap-3"
                style={{
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: C.border,
                }}
              >
                <View
                  className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${COLOR}15` }}
                >
                  <Text className="text-xs font-bold" style={{ color: COLOR }}>
                    {it.serial_no}
                  </Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-foreground leading-5">
                    {it.task_name}
                  </Text>
                  {it.brief_description ? (
                    <Text className="text-xs text-muted-foreground leading-4" selectable>
                      {it.brief_description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Mukadma integration note */}
        {checklist.crime_type ? (
          <View className="bg-secondary rounded-xl px-4 py-3">
            <Text className="text-xs text-muted-foreground leading-5">
              {t('knowledge.checklist.karyvahiNote', {
                crimeType: [checklist.crime_type, checklist.crime_subtype].filter(Boolean).join(' › '),
                count: items.length,
              })}
            </Text>
          </View>
        ) : null}

        {/* Audit */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.checklist.created', { date: fmtTs(checklist.created_at) })}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Clock size={12} color={C.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {t('knowledge.checklist.modified', { date: fmtTs(checklist.updated_at) })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.checklist.deleteChecklistTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.checklist.deleteChecklistDesc', { title: checklist.title, count: items.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDelete(false)}>
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
