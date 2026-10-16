import { DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';

/**
 * THEME — hex token palettes mirroring global.css CSS variables.
 *
 * Use these for inline styles, Reanimated interpolations, and icon `color`
 * props that cannot go through Tailwind className. Tailwind-class consumers
 * automatically pick up the active palette via NativeWind's colorScheme.
 *
 * SOFT INDIGO (light):
 *   background  #F4F7FE   card    #FFFFFF   foreground  #111827
 *   primary     #6366F1   border  #E5E7EB   muted-fg    #6B7280
 *
 * MIDNIGHT INDIGO (dark):
 *   background  #0F172A   card    #1E293B   foreground  #F1F5F9
 *   primary     #818CF8   border  #334155   muted-fg    #94A3B8
 */
const SOFT_INDIGO = {
  background:           '#F4F7FE',
  foreground:           '#111827',
  card:                 '#FFFFFF',
  cardForeground:       '#111827',
  popover:              '#FFFFFF',
  popoverForeground:    '#111827',
  primary:              '#6366F1',
  primaryForeground:    '#FFFFFF',
  secondary:            '#F1F5F9',
  secondaryForeground:  '#111827',
  muted:                '#F1F5F9',
  mutedForeground:      '#6B7280',
  accent:               '#EEF2FF',
  accentForeground:     '#4F46E5',
  destructive:          '#DC2626',
  destructiveForeground:'#FFFFFF',
  border:               '#E5E7EB',
  input:                '#E5E7EB',
  ring:                 '#6366F1',
};

const MIDNIGHT_INDIGO = {
  background:           '#0F172A',
  foreground:           '#F1F5F9',
  card:                 '#1E293B',
  cardForeground:       '#F1F5F9',
  popover:              '#1E293B',
  popoverForeground:    '#F1F5F9',
  primary:              '#818CF8',
  primaryForeground:    '#0F172A',
  secondary:            '#1E293B',
  secondaryForeground:  '#F1F5F9',
  muted:                '#1E293B',
  mutedForeground:      '#94A3B8',
  accent:               '#1E1B4B',
  accentForeground:     '#C7D2FE',
  destructive:          '#F87171',
  destructiveForeground:'#0F172A',
  border:               '#334155',
  input:                '#334155',
  ring:                 '#818CF8',
};

export const THEME = {
  light: SOFT_INDIGO,
  dark:  MIDNIGHT_INDIGO,
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background:   SOFT_INDIGO.background,
      border:       SOFT_INDIGO.border,
      card:         SOFT_INDIGO.card,
      notification: SOFT_INDIGO.destructive,
      primary:      SOFT_INDIGO.primary,
      text:         SOFT_INDIGO.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background:   MIDNIGHT_INDIGO.background,
      border:       MIDNIGHT_INDIGO.border,
      card:         MIDNIGHT_INDIGO.card,
      notification: MIDNIGHT_INDIGO.destructive,
      primary:      MIDNIGHT_INDIGO.primary,
      text:         MIDNIGHT_INDIGO.foreground,
    },
  },
};
