import { DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';

/**
 * THEME — hex token palettes mirroring global.css CSS variables.
 *
 * Use these for inline styles, Reanimated interpolations, and icon `color`
 * props that cannot go through Tailwind className. Tailwind-class consumers
 * automatically pick up the active palette via NativeWind's colorScheme.
 *
 * TRUST GREEN (light):
 *   background  #F7FAF5   card    #FFFFFF   foreground  #111827
 *   primary     #16A34A   border  #E3E9E2   muted-fg    #5D6B5D
 *
 * TRUST GREEN (dark):
 *   background  #14201A   card    #1C2B22   foreground  #F1F5F9
 *   primary     #4ADE80   border  #324539   muted-fg    #9CAFA3
 */
const SOFT_INDIGO = {
  background:           '#F7FAF5',
  foreground:           '#111827',
  card:                 '#FFFFFF',
  cardForeground:       '#111827',
  popover:              '#FFFFFF',
  popoverForeground:    '#111827',
  primary:              '#16A34A',
  primaryForeground:    '#FFFFFF',
  secondary:            '#F1F5F1',
  secondaryForeground:  '#111827',
  muted:                '#F1F5F1',
  mutedForeground:      '#5D6B5D',
  accent:               '#F0FDF4',
  accentForeground:     '#15803D',
  destructive:          '#DC2626',
  destructiveForeground:'#FFFFFF',
  border:               '#E3E9E2',
  input:                '#E3E9E2',
  ring:                 '#16A34A',
};

const MIDNIGHT_INDIGO = {
  background:           '#14201A',
  foreground:           '#F1F5F9',
  card:                 '#1C2B22',
  cardForeground:       '#F1F5F9',
  popover:              '#1C2B22',
  popoverForeground:    '#F1F5F9',
  primary:              '#4ADE80',
  primaryForeground:    '#0F2016',
  secondary:            '#1C2B22',
  secondaryForeground:  '#F1F5F9',
  muted:                '#1C2B22',
  mutedForeground:      '#9CAFA3',
  accent:               '#163322',
  accentForeground:     '#BBF7D0',
  destructive:          '#F87171',
  destructiveForeground:'#0F172A',
  border:               '#324539',
  input:                '#324539',
  ring:                 '#4ADE80',
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
