/**
 * Native: статического HTML нет, а `LocaleProvider.tsx` сам не монтирует детей,
 * пока не применит сохранённую локаль, — до запуска приложения ждать нечего.
 * Web-механизм — `bootLocale.web.ts` (#2239).
 */
export const prepareBootLocale = (): Promise<void> | null => null
