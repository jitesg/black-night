import { useCallback, useState } from 'react';
import { stripHtmlTags } from '@/lib/stringUtils';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookMarked, Calendar, Clock, Copy,
  Edit2, LayoutTemplate, Share2, Star, Trash2,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import {
  getGdById, toggleGdFavorite, deleteGdEntry, type GdEntry,
} from '@/lib/db/gdRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const GD_COLOR = '#D97706';

const TYPE_COLORS: Record<string, string> = {
  'रवानगी': '#6366F1',
  'वापसी':  '#059669',
  'तस्करा': '#DC2626',
  'अन्य':   '#6B7280',
};

function fmtDate(str: string): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function GdDetailScreen() {
  const { gdId } = useLocalSearchParams<{ gdId: string }>();

  const [entry, setEntry] = useState<GdEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!gdId) return;
      let isMounted = true;
      (async () => {
        setLoading(true);
        const e = await getGdById(gdId);
        if (isMounted) { setEntry(e); setLoading(false); }
      })();
      return () => { isMounted = false; };
    }, [gdId])
  );

  const handleFavorite = async () => {
    if (!entry) return;
    await toggleGdFavorite(entry.id, entry.is_favorite);
    setEntry((prev) => prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev);
  };

  const handleCopy = async () => {
    if (!entry) return;
    const text = `GD Type: ${entry.gd_type}\nDate: ${fmtDate(entry.preparation_date)}\n\n${stripHtmlTags(entry.vivran_content)}`;
    if (process.env.EXPO_OS === 'web') {
      try { await navigator.clipboard.writeText(text); } catch { /* silent */ }
    } else {
      await Clipboard.setStringAsync(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!entry) return;
    const text = `GD Type: ${entry.gd_type}\nDate: ${fmtDate(entry.preparation_date)}\n\n${stripHtmlTags(entry.vivran_content)}`;
    try {
      await Share.share({ message: text, title: `GD – ${entry.gd_type}` });
    } catch { /* cancelled */ }
  };

  const handleDeleteConfirm = async () => {
    if (!entry) return;
    await deleteGdEntry(entry.id);
    setShowDelete(false);
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading…</Text>
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-background items-center justify-center gap-3 px-6">
        <Text className="text-base font-semibold text-foreground">Entry not found</Text>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Text className="text-sm text-primary">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const typeColor = TYPE_COLORS[entry.gd_type] ?? '#6B7280';

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={entry.gd_type}
        subtitle={fmtDate(entry.preparation_date)}
        showBack
        actions={
          <Pressable onPress={async () => { try { await toggleGdFavorite(entry.id, entry.is_favorite); setEntry((prev) => prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev); } catch {} }} className="w-9 h-9 items-center justify-center rounded-xl active:opacity-60" accessibilityLabel="Toggle favourite">
            <Star size={20} color={entry.is_favorite ? '#D97706' : '#D1D5DB'} fill={entry.is_favorite ? '#D97706' : 'none'} />
          </Pressable>
        }
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">

        {/* Action bar */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push(`/(app)/gd/add-gd?editId=${entry.id}` as never)}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Edit2 size={14} color="#374151" />
            <Text className="text-sm font-medium text-foreground">Edit</Text>
          </Pressable>
          <Pressable
            onPress={handleCopy}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Copy size={14} color={copied ? '#059669' : '#374151'} />
            <Text className={`text-sm font-medium ${copied ? 'text-[#059669]' : 'text-foreground'}`}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Share2 size={14} color="#374151" />
            <Text className="text-sm font-medium text-foreground">Share</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowDelete(true)}
            className="w-10 items-center justify-center rounded-xl active:opacity-70 border border-border bg-card"
            style={{ borderCurve: 'continuous' }}
          >
            <Trash2 size={14} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-6 py-5 gap-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Meta row */}
        <View className="flex-row flex-wrap gap-2">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: `${typeColor}15` }}
          >
            <Text className="text-xs font-semibold" style={{ color: typeColor }}>
              {entry.gd_type}
            </Text>
          </View>
          {entry.ta_da_flag === 1 && (
            <View className="rounded-full px-3 py-1 bg-amber-50 border border-amber-200">
              <Text className="text-xs font-medium text-amber-700">TA/DA</Text>
            </View>
          )}
          {entry.format_id && (
            <View className="rounded-full px-3 py-1 flex-row items-center gap-1" style={{ backgroundColor: '#0891B210' }}>
              <LayoutTemplate size={10} color="#0891B2" />
              <Text className="text-xs font-medium text-[#0891B2]">From Template</Text>
            </View>
          )}
        </View>

        {/* Date info */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center gap-2">
            <Calendar size={14} color={GD_COLOR} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Preparation Date
            </Text>
          </View>
          <Text className="text-base font-medium text-foreground">{fmtDate(entry.preparation_date)}</Text>
        </View>

        {/* Vivran */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Vivran (Content)
          </Text>
          <Text className="text-base text-foreground leading-7" selectable>
            {stripHtmlTags(entry.vivran_content)}
          </Text>
        </View>

        {/* Audit info */}
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Clock size={12} color="#9CA3AF" />
            <Text className="text-xs text-muted-foreground">Created: {fmtTs(entry.created_at)}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Clock size={12} color="#9CA3AF" />
            <Text className="text-xs text-muted-foreground">Modified: {fmtTs(entry.updated_at)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GD Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this{' '}
              <Text className="font-semibold text-foreground">{entry.gd_type}</Text>
              {' '}entry dated{' '}
              <Text className="font-semibold text-foreground">{fmtDate(entry.preparation_date)}</Text>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setShowDelete(false)}>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
