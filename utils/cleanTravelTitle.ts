export const cleanTravelTitle = (title: string, country: string | null | undefined): string => {
  if (!country || !title) return title;

  const countryText = String(country).trim();
  if (!countryText) return title;

  const countryPatterns = [
    `в ${countryText}`,
    `в ${countryText.toLowerCase()}`,
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
