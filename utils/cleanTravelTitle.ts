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

  // Страна вырезается из любого места строки, поэтому осиротеть может каждый
  // край, а не только хвост: «Польша. Варшава — Закопане» превращалось в
  // «. Варшава — Закопане», а «Польша за 4 дня: маршрут из Минска в Гданьск» —
  // в «за 4 дня: …» со строчной буквы. Оба варианта видны на /favorites и в
  // истории просмотров.
  cleanedTitle = cleanedTitle
    .replace(/^\s*[,.:;–—-]\s*/, '')
    .replace(/\s*[,.:;–—-]\s*$/, '')
    .trim();
  if (!cleanedTitle) return title;

  return cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
};
