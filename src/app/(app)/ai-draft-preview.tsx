import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { GeneratedReportView } from '@/components/common/GeneratedReportView';
import { aiDraftStore } from '@/lib/ai/aiDraftStore';
import type { AIDraft } from '@/ai/AITypes';

export default function AIDraftPreviewScreen() {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [draft, setDraft] = useState<AIDraft | null>(null);

  useEffect(() => {
    setDraft(aiDraftStore.consumeDraft());
  }, []);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={draft?.title ?? 'AI Draft'} subtitle="AI Investigation Copilot" showBack />
      <View className="flex-1 px-6 py-5">
        {draft ? (
          <GeneratedReportView
            content={draft.content}
            title={draft.title}
            sharePrefix={draft.firNumber ? `FIR ${draft.firNumber}` : undefined}
          />
        ) : (
          <Text className="text-sm text-muted-foreground text-center mt-10">
            No draft available. Please generate it again from AI Copilot.
          </Text>
        )}
      </View>
    </View>
  );
}
