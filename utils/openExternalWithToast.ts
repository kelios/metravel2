import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n';

/** Открывает внешнюю ссылку; при неудаче сообщает тостом (это не переключатель, а навигация). */
export const openExternal = async (url?: string) => {
  try {
    const opened = await openExternalUrlInNewTab(url ?? '', {
      allowRelative: true,
      baseUrl: getSiteBaseUrl(),
    });
    if (!opened) await showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_otkryt_ssylku_e0811744'), position: 'bottom' });
  } catch {
    await showToast({ type: 'info', text1: i18nT('shared:hooks.useAddressListItemActions.ne_udalos_otkryt_ssylku_e0811744'), position: 'bottom' });
  }
};
