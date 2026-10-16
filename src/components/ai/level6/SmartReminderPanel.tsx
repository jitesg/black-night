/**
 * SmartReminderPanel.tsx
 * Level-6 UI: Smart investigation reminders grouped by urgency.
 * No actions — officer makes all decisions.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { SmartReminderReport, SmartReminder } from '../../../ai/level6/L6Types';
import type { IntelSeverity } from '../../../ai/intelligence/IntelligenceTypes';

interface Props {
  report: SmartReminderReport;
}

function severityBg(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-50 border-red-200';
    case 'high':     return 'bg-orange-50 border-orange-200';
    case 'medium':   return 'bg-yellow-50 border-yellow-200';
    case 'low':      return 'bg-muted border-border';
    default:         return 'bg-muted border-border';
  }
}

function severityDot(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'high':     return 'bg-orange-500';
    case 'medium':   return 'bg-yellow-500';
    default:         return 'bg-muted-foreground';
  }
}

function severityText(severity: IntelSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-700';
    case 'high':     return 'text-orange-700';
    case 'medium':   return 'text-yellow-700';
    default:         return 'text-muted-foreground';
  }
}

function dueLabelColor(r: SmartReminder): string {
  if (r.isOverdue)                                  return 'text-red-600 bg-red-50';
  if ((r.daysRemaining ?? 99) <= 1)                 return 'text-orange-600 bg-orange-50';
  if ((r.daysRemaining ?? 99) <= 3)                 return 'text-yellow-700 bg-yellow-50';
  return 'text-muted-foreground bg-muted';
}

function dueLabel(r: SmartReminder): string {
  if (r.isOverdue)                                  return `${Math.abs(r.daysRemaining ?? 0)}d overdue`;
  if ((r.daysRemaining ?? 99) === 0)                return 'Due today';
  if ((r.daysRemaining ?? 99) === 1)                return 'Due tomorrow';
  if (r.daysRemaining !== undefined)                return `${r.daysRemaining}d remaining`;
  if (r.dueDate)                                    return `Due ${r.dueDate}`;
  return 'Pending';
}

function ReminderCard({ reminder }: { reminder: SmartReminder }) {
  return (
    <View className={`mx-4 mb-2 p-3 rounded-xl border ${severityBg(reminder.severity)}`}>
      <View className="flex-row items-start gap-2">
        <View className={`w-2 h-2 rounded-full mt-1.5 ${severityDot(reminder.severity)}`} />
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={2}>
              {reminder.title}
            </Text>
            <View className={`px-2 py-0.5 rounded-full ${dueLabelColor(reminder)}`}>
              <Text className={`text-xs font-medium ${dueLabelColor(reminder).split(' ')[0]}`}>
                {dueLabel(reminder)}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-muted-foreground mt-1 mb-1">{reminder.description}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-foreground">→ {reminder.suggestedAction}</Text>
          </View>
          {reminder.legalReference && (
            <Text className="text-xs text-muted-foreground mt-0.5">📜 {reminder.legalReference}</Text>
          )}
          {reminder.requiresImmediateAction && (
            <Text className={`text-xs font-semibold mt-1 ${severityText(reminder.severity)}`}>
              Requires immediate attention
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function SmartReminderPanel({ report }: Props) {
  const overdue    = report.reminders.filter((r) => r.isOverdue);
  const dueToday   = report.reminders.filter((r) => !r.isOverdue && (r.daysRemaining ?? 99) <= 1);
  const upcoming   = report.reminders.filter((r) => !r.isOverdue && (r.daysRemaining ?? 99) > 1);

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Stats header */}
      <View className="mx-4 mt-4 mb-3 flex-row gap-2">
        <View className="flex-1 p-2 bg-red-50 rounded-xl border border-red-200 items-center">
          <Text className="text-lg font-bold text-red-600">{report.overdueCount}</Text>
          <Text className="text-xs text-red-500">Overdue</Text>
        </View>
        <View className="flex-1 p-2 bg-orange-50 rounded-xl border border-orange-200 items-center">
          <Text className="text-lg font-bold text-orange-600">{report.dueTodayCount}</Text>
          <Text className="text-xs text-orange-500">Today</Text>
        </View>
        <View className="flex-1 p-2 bg-yellow-50 rounded-xl border border-yellow-200 items-center">
          <Text className="text-lg font-bold text-yellow-700">{report.dueThisWeekCount}</Text>
          <Text className="text-xs text-yellow-600">This week</Text>
        </View>
        <View className="flex-1 p-2 bg-muted rounded-xl border border-border items-center">
          <Text className="text-lg font-bold text-foreground">{report.reminders.length}</Text>
          <Text className="text-xs text-muted-foreground">Total</Text>
        </View>
      </View>

      {report.reminders.length === 0 && (
        <View className="mx-4 p-6 items-center">
          <Text className="text-2xl mb-2">✅</Text>
          <Text className="text-sm font-medium text-foreground">All clear</Text>
          <Text className="text-xs text-muted-foreground mt-1">{report.summary}</Text>
        </View>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <View className="mb-2">
          <Text className="text-xs font-semibold text-red-700 mx-4 mb-1 uppercase tracking-wider">
            Overdue
          </Text>
          {overdue.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        </View>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <View className="mb-2">
          <Text className="text-xs font-semibold text-orange-700 mx-4 mb-1 uppercase tracking-wider">
            Due Today / Tomorrow
          </Text>
          {dueToday.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        </View>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <View className="mb-2">
          <Text className="text-xs font-semibold text-muted-foreground mx-4 mb-1 uppercase tracking-wider">
            Upcoming
          </Text>
          {upcoming.map((r) => <ReminderCard key={r.id} reminder={r} />)}
        </View>
      )}

      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl mt-2">
        <Text className="text-xs text-muted-foreground text-center italic">
          Reminders are advisory only. Officer makes all decisions.
        </Text>
      </View>
    </ScrollView>
  );
}
