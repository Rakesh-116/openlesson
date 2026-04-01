/**
 * Tutoring languages — the languages the AI tutor can respond in.
 * This is a SUPERSET of UI locales (which only have translation files).
 * Some languages here (e.g. Catalan) are tutoring-only with no UI translation.
 */

export const tutoringLocales = ['en', 'vi', 'zh', 'es', 'de', 'pl', 'ca'] as const;
export type TutoringLocale = typeof tutoringLocales[number];

export const tutoringLanguageNames: Record<TutoringLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
  es: 'Español',
  de: 'Deutsch',
  pl: 'Polski',
  ca: 'Català',
};

/**
 * Map locale code to full language name for LLM prompts.
 * Falls back to English if unknown.
 */
export function getLanguageName(locale: string): string {
  return tutoringLanguageNames[locale as TutoringLocale] || "English";
}
