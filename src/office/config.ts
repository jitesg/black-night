/**
 * InvestSuite कार्यालय — which app is this build, and the owner's Supabase project.
 * EXPO_PUBLIC_APP_VARIANT is put into the bundle at build time (CI: "office" for the कार्यालय APK).
 * The publishable key is meant to be in the app (Row Level Security protects the data); NEVER put the
 * service_role / secret key here.
 */
export const IS_OFFICE = process.env.EXPO_PUBLIC_APP_VARIANT === 'office';

export const OFFICE_SUPABASE_URL = 'https://pmezkxwkehjbyzxomlre.supabase.co';
export const OFFICE_SUPABASE_KEY = 'sb_publishable_YzOUIuRk5kLPz53I4jIcOg_J2B2ZwOC';

/** Navy of the कार्यालय app (light / dark). */
export const OFFICE_NAVY = { light: '#1E3A5F', dark: '#93C5FD' } as const;
