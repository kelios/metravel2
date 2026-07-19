import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { TravelFormData } from '@/types/types';
import { showToastMessage } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import { publishTravelToInstagram, fetchInstagramOAuthStartUrl } from '@/api/instagramPublish';
import {
    getInstagramAccountOptions,
    parseInstagramHashtags,
} from '@/utils/instagramPublish';
import { translate as i18nT } from '@/i18n';
import { useInstagramPublishDraft } from '@/components/travel/useInstagramPublishDraft';

type CountryOption = {
    country_id: string;
    title_ru: string;
    title_en?: string;
    title?: string;
    name?: string;
};

type UseInstagramPublishFlowArgs = {
    formData: TravelFormData;
    countries: CountryOption[];
};

export function useInstagramPublishFlow({ formData, countries }: UseInstagramPublishFlowArgs) {
    const draft = useInstagramPublishDraft({ formData, countries });

    const {
        editableInstagramCaption,
        editableInstagramImages,
        editableInstagramHashtags,
        finalInstagramText,
    } = draft;

    const instagramPublishingRef = useRef(false);
    const [isPublishingInstagram, setIsPublishingInstagram] = useState(false);
    const instagramConnectingRef = useRef(false);
    const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);

    const instagramAccountKey = useMemo(
        () =>
            getInstagramAccountOptions(process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS)[0]?.key ||
            'metravelby',
        [],
    );

    const handleCopyInstagramText = useCallback(async () => {
        const finalText = finalInstagramText;
        if (!finalText) return;
        await Clipboard.setStringAsync(finalText);
        void showToastMessage({
            type: 'success',
            text1: i18nT('travel:components.travel.TravelWizardStepPublish.tekst_dlya_instagram_skopirovan_d5e8c582'),
        });
    }, [finalInstagramText]);

    // Подключение аккаунта: бэк сам отдаёт authUrl с корректным redirect и подписанным
    // state (фронт НЕ строит OAuth-URL сам — старый /auth/instagram/callback не существует).
    const handleConnectInstagram = useCallback(async () => {
        if (instagramConnectingRef.current) return;
        instagramConnectingRef.current = true;
        setIsConnectingInstagram(true);
        try {
            const returnTo =
                Platform.OS === 'web' && typeof window !== 'undefined'
                    ? window.location?.href
                    : undefined;
            const authUrl = await fetchInstagramOAuthStartUrl(returnTo);
            if (!authUrl) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.instagram_ne_nastroen_na_servere_080724da'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.nuzhny_klyuchi_meta_na_bekende_zadacha_be_06_3ef88e17'),
                });
                return;
            }
            const opened = await openExternalUrl(authUrl);
            if (!opened) {
                void showToastMessage({
                    type: 'error',
                    text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_otkryt_meta_oauth_3c11f44b'),
                    text2: i18nT('travel:components.travel.TravelWizardStepPublish.proverte_blokirovku_vsplyvayuschih_okon_i_po_e1079518'),
                });
            }
        } catch (error) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_nachat_podklyuchenie_instagram_409edc30'),
                text2: error instanceof Error ? error.message : i18nT('travel:components.travel.TravelWizardStepPublish.povtorite_popytku_pozzhe_fa7a4481'),
            });
        } finally {
            instagramConnectingRef.current = false;
            setIsConnectingInstagram(false);
        }
    }, []);

    const handlePublishToInstagram = useCallback(async () => {
        // Защита от двойного клика.
        if (instagramPublishingRef.current) return;

        const travelId = Number(formData.id);
        if (!Number.isFinite(travelId) || travelId <= 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.snachala_sohranite_puteshestvie_f91c1dce'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.publikatsiya_v_instagram_dostupna_posle_sohr_4e51d7a0'),
            });
            return;
        }

        const imageUrls = editableInstagramImages.filter(Boolean);
        if (imageUrls.length === 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.net_foto_dlya_publikatsii_26980134'),
                text2: i18nT('travel:components.travel.TravelWizardStepPublish.dobavte_hotya_by_odno_foto_v_galereyu_ee5be50f'),
            });
            return;
        }

        instagramPublishingRef.current = true;
        setIsPublishingInstagram(true);
        try {
            const result = await publishTravelToInstagram({
                travelId,
                accountKey: instagramAccountKey,
                caption: editableInstagramCaption.trim(),
                hashtags: parseInstagramHashtags(editableInstagramHashtags),
                imageUrls,
            });
            void showToastMessage({
                type: 'success',
                text1: i18nT('travel:components.travel.TravelWizardStepPublish.opublikovano_v_instagram_0edea0fd'),
                text2: result?.postUrl || undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const notConnected = new RegExp(
                i18nT('travel:components.travel.TravelWizardStepPublish.instagramNotConnectedPattern'),
                'i',
            ).test(message);
            void showToastMessage({
                type: 'error',
                text1: notConnected ? i18nT('travel:components.travel.TravelWizardStepPublish.akkaunt_instagram_ne_podklyuchen_a04bf7ce') : i18nT('travel:components.travel.TravelWizardStepPublish.ne_udalos_opublikovat_3fbabd22'),
                text2: notConnected
                    ? i18nT('travel:components.travel.TravelWizardStepPublish.nazhmite_podklyuchit_instagram_zatem_povtori_6c7379a0')
                    : message,
            });
        } finally {
            instagramPublishingRef.current = false;
            setIsPublishingInstagram(false);
        }
    }, [
        formData.id,
        editableInstagramImages,
        editableInstagramCaption,
        editableInstagramHashtags,
        instagramAccountKey,
    ]);

    return {
        ...draft,
        isConnectingInstagram,
        isPublishingInstagram,
        handleCopyInstagramText,
        handleConnectInstagram,
        handlePublishToInstagram,
    };
}
