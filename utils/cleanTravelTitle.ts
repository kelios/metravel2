import { translate as i18nT } from '@/i18n'
export const cleanTravelTitle = (title: string, country: string | null | undefined): string => {
  if (!country || !title) return title;

  const countryText = String(country).trim();
  if (!countryText) return title;

  const countryPatterns = [
    i18nT('shared:utils.cleanTravelTitle.v_value1_9136f2be', { value1: countryText }),
    i18nT('shared:utils.cleanTravelTitle.v_value1_9136f2be', { value1: countryText.toLowerCase() }),
    countryText,
    countryText.toLowerCase(),
  ];

  let cleanedTitle = title;
  countryPatterns.forEach((pattern) => {
    cleanedTitle = cleanedTitle.replace(pattern, '').trim();
  });

  cleanedTitle = cleanedTitle.replace(/\s*[,.\-:]\s*$/, '').trim();
  return cleanedTitle || title;
};
