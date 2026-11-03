import {translate,translatePlural, type TranslationParams} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';
import type {PrintCityId} from '@/data/travelBooks/schema/providers';

// Literal keys: the web build inlines only statically named catalog entries.
const copy = {
  providerTitle: (params?: TranslationParams) => translate('books:providerTitle', params),
  providerIntro: (params?: TranslationParams) => translate('books:providerIntro', params),
  providerCountry: (params?: TranslationParams) => translate('books:providerCountry', params),
  providerBY: (params?: TranslationParams) => translate('books:providerBY', params),
  providerPL: (params?: TranslationParams) => translate('books:providerPL', params),
  providerCity: (params?: TranslationParams) => translate('books:providerCity', params),
  providerFormat: (params?: TranslationParams) => translate('books:providerFormat', params),
  providerPocket: (params?: TranslationParams) => translate('books:providerPocket', params),
  providerAlbum: (params?: TranslationParams) => translate('books:providerAlbum', params),
  providerEmpty: (params?: TranslationParams) => translate('books:providerEmpty', params),
  providerWebsite: (params?: TranslationParams) => translate('books:providerWebsite', params),
  providerSource: (params?: TranslationParams) => translate('books:providerSource', params),
  providerOpenError: (params?: TranslationParams) => translate('books:providerOpenError', params),
  providerDetails: (params?: TranslationParams) => translate('books:providerDetails', params),
  providerNoTransfer: (params?: TranslationParams) => translate('books:providerNoTransfer', params),
  providerPreparation: (params?: TranslationParams) => translate('books:providerPreparation', params),
  providerPrinting: (params?: TranslationParams) => translate('books:providerPrinting', params),
  providerColour: (params?: TranslationParams) => translate('books:providerColour', params),
  providerFromPdf: (params?: TranslationParams) => translate('books:providerFromPdf', params),
  providerBinding: (params?: TranslationParams) => translate('books:providerBinding', params),
  providerBindingRings: (params?: TranslationParams) => translate('books:providerBindingRings', params),
  providerBindingSpiral: (params?: TranslationParams) => translate('books:providerBindingSpiral', params),
  providerBindingStapled: (params?: TranslationParams) => translate('books:providerBindingStapled', params),
  providerBindingGlued: (params?: TranslationParams) => translate('books:providerBindingGlued', params),
  providerBindingSoft: (params?: TranslationParams) => translate('books:providerBindingSoft', params),
  providerBindingHard: (params?: TranslationParams) => translate('books:providerBindingHard', params),
  providerFontsEmbedded: (params?: TranslationParams) => translate('books:providerFontsEmbedded', params),
  providerFontsOutlines: (params?: TranslationParams) => translate('books:providerFontsOutlines', params),
  providerFontsAsk: (params?: TranslationParams) => translate('books:providerFontsAsk', params),
  providerLoadError: (params?: TranslationParams) => translate('books:providerLoadError', params),
  providerCityMinsk: (params?: TranslationParams) => translate('books:providerCityMinsk', params),
  providerCityBrest: (params?: TranslationParams) => translate('books:providerCityBrest', params),
  providerCityVitebsk: (params?: TranslationParams) => translate('books:providerCityVitebsk', params),
  providerCityGomel: (params?: TranslationParams) => translate('books:providerCityGomel', params),
  providerCityGrodno: (params?: TranslationParams) => translate('books:providerCityGrodno', params),
  providerCityMogilev: (params?: TranslationParams) => translate('books:providerCityMogilev', params),
  providerCityWarszawa: (params?: TranslationParams) => translate('books:providerCityWarszawa', params),
  providerCityKrakow: (params?: TranslationParams) => translate('books:providerCityKrakow', params),
  providerCityWroclaw: (params?: TranslationParams) => translate('books:providerCityWroclaw', params),
  providerCityGdansk: (params?: TranslationParams) => translate('books:providerCityGdansk', params),
  providerCityPoznan: (params?: TranslationParams) => translate('books:providerCityPoznan', params),
  providerCityLodz: (params?: TranslationParams) => translate('books:providerCityLodz', params),
  providerCityKatowice: (params?: TranslationParams) => translate('books:providerCityKatowice', params),
  providerCityLublin: (params?: TranslationParams) => translate('books:providerCityLublin', params),
  providerCitySzczecin: (params?: TranslationParams) => translate('books:providerCitySzczecin', params),
  providerCityBialystok: (params?: TranslationParams) => translate('books:providerCityBialystok', params),
  retry: (params?: TranslationParams) => translate('books:retry', params),
  loadingPage: (params?: TranslationParams) => translate('books:loadingPage', params),
  providerSummary: (params?: TranslationParams) => translate('books:providerSummary', params),
  providerCitiesBY: (params?: TranslationParams) => translatePlural('books:providerCitiesBY', Number(params?.count), params),
  providerCitiesPL: (params?: TranslationParams) => translatePlural('books:providerCitiesPL', Number(params?.count), params),
};
export type ProviderCopyKey = keyof typeof copy;
export type ProviderCopy = (key: ProviderCopyKey, params?: TranslationParams) => string;

const CITY_KEYS = {
  minsk: 'providerCityMinsk',
  brest: 'providerCityBrest',
  vitebsk: 'providerCityVitebsk',
  gomel: 'providerCityGomel',
  grodno: 'providerCityGrodno',
  mogilev: 'providerCityMogilev',
  warszawa: 'providerCityWarszawa',
  krakow: 'providerCityKrakow',
  wroclaw: 'providerCityWroclaw',
  gdansk: 'providerCityGdansk',
  poznan: 'providerCityPoznan',
  lodz: 'providerCityLodz',
  katowice: 'providerCityKatowice',
  lublin: 'providerCityLublin',
  szczecin: 'providerCitySzczecin',
  bialystok: 'providerCityBialystok',
} as const satisfies Record<PrintCityId, ProviderCopyKey>;
export const cityKey = (city: PrintCityId) => CITY_KEYS[city];

export function useProviderCopy(): ProviderCopy {
  useLocaleRevision();
  return (key, params) => copy[key](params);
}
