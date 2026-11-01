import {translate, type TranslationParams} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';

const copy = {
  providerTitle: (params?: TranslationParams) => translate('books:providerTitle', params),
  providerIntro: (params?: TranslationParams) => translate('books:providerIntro', params),
  providerCountry: (params?: TranslationParams) => translate('books:providerCountry', params),
  providerBY: (params?: TranslationParams) => translate('books:providerBY', params),
  providerPL: (params?: TranslationParams) => translate('books:providerPL', params),
  providerFormat: (params?: TranslationParams) => translate('books:providerFormat', params),
  providerPocket: (params?: TranslationParams) => translate('books:providerPocket', params),
  providerAlbum: (params?: TranslationParams) => translate('books:providerAlbum', params),
  providerEmpty: (params?: TranslationParams) => translate('books:providerEmpty', params),
  providerChecked: (params?: TranslationParams) => translate('books:providerChecked', params),
  providerWebsite: (params?: TranslationParams) => translate('books:providerWebsite', params),
  providerSource: (params?: TranslationParams) => translate('books:providerSource', params),
  providerOpenError: (params?: TranslationParams) => translate('books:providerOpenError', params),
  providerDetails: (params?: TranslationParams) => translate('books:providerDetails', params),
  providerNoTransfer: (params?: TranslationParams) => translate('books:providerNoTransfer', params),
  providerPreparation: (params?: TranslationParams) => translate('books:providerPreparation', params),
  providerA4: (params?: TranslationParams) => translate('books:providerA4', params),
  providerFontsInferred: (params?: TranslationParams) => translate('books:providerFontsInferred', params),
  providerFontsConfirm: (params?: TranslationParams) => translate('books:providerFontsConfirm', params),
  providerNativeA5: (params?: TranslationParams) => translate('books:providerNativeA5', params),
  providerNativeUnknown: (params?: TranslationParams) => translate('books:providerNativeUnknown', params),
  pageError: (params?: TranslationParams) => translate('books:pageError', params),
  retry: (params?: TranslationParams) => translate('books:retry', params),
  loadingPage: (params?: TranslationParams) => translate('books:loadingPage', params),
};
export function useProviderCopy() {
  useLocaleRevision();
  return (key: keyof typeof copy, params?: TranslationParams) => copy[key](params);
}
