/**
 * FardTypePickerSheet.tsx
 *
 * Bottom sheet modal displaying all 11 Fard types from Fard Knowledge Base.
 * Used when an officer taps 'फर्द जाँचें' and no type was automatically detected,
 * or when the officer wishes to change the fard inspection type.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  FileText,
  Scale,
  X,
} from 'lucide-react-native';
import { getFardEntries } from '@/knowledge/fard/fardKb';
import type { FardEntry } from '@/knowledge/fard/types';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

export interface FardTypePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectType: (code: string) => void;
  selectedCode?: string | null;
}

export function FardTypePickerSheet({
  visible,
  onClose,
  onSelectType,
  selectedCode,
}: FardTypePickerSheetProps) {
  const { t } = useTranslation();
  const entries = getFardEntries();

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ paddingBottom: NAV_BAR_INSET }} className="flex-1 justify-end bg-black/50">
        {/* Backdrop */}
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityLabel={t('common.close', 'बंद करें')}
          accessibilityRole="button"
        />

        {/* Sheet Content */}
        <View
          className="bg-card rounded-t-3xl border-t border-border shadow-2xl max-h-[82%]"
          style={{ borderCurve: 'continuous' }}
        >
          {/* Grab Handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border/60">
            <View className="flex-1 pr-3">
              <Text className="text-base font-bold text-foreground">
                {t('fard.selectTypeTitle', 'फर्द का प्रकार चुनें')}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {t('fard.selectTypeSubtitle', 'जाँच के लिए उपयुक्त फर्द प्रारूप चुनें')} ({entries.length})
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="p-1.5 rounded-full bg-muted/60 active:opacity-70"
              accessibilityLabel={t('common.close', 'बंद करें')}
              accessibilityRole="button"
            >
              <X size={18} className="text-foreground" />
            </Pressable>
          </View>

          {/* List of 11 Fard Types */}
          <ScrollView
            className="p-4"
            contentContainerClassName="gap-2.5 pb-8"
            showsVerticalScrollIndicator={false}
          >
            {entries.map((entry: FardEntry) => {
              const isSelected = selectedCode === entry.code;
              const primaryLegal = entry.legal ? entry.legal.split(';')[0].trim() : '';

              return (
                <Pressable
                  key={entry.code}
                  onPress={() => onSelectType(entry.code)}
                  className={`flex-row items-center gap-3 p-3.5 rounded-2xl border active:opacity-70 ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-background/80 border-border'
                  }`}
                  style={{ borderCurve: 'continuous' }}
                  accessibilityRole="button"
                  accessibilityLabel={entry.name}
                >
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center ${
                      isSelected ? 'bg-primary' : 'bg-muted/60'
                    }`}
                  >
                    <FileText
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#64748B'}
                    />
                  </View>

                  <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}
                        numberOfLines={1}
                      >
                        {entry.name}
                      </Text>
                      {primaryLegal ? (
                        <View className="flex-row items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/80">
                          <Scale size={10} className="text-muted-foreground" />
                          <Text className="text-[10px] text-muted-foreground font-medium" numberOfLines={1}>
                            {primaryLegal}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {entry.purpose ? (
                      <Text
                        className="text-xs text-muted-foreground"
                        numberOfLines={2}
                      >
                        {entry.purpose}
                      </Text>
                    ) : null}
                  </View>

                  <ChevronRight size={16} className="text-muted-foreground" />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
