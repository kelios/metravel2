/**
 * Карточка «SEO-описание» на шаге публикации (#2885): поле `meta_description`
 * (сниппет поиска, бюджет `TRAVEL_META_DESCRIPTION_MAX_LENGTH`, сервер хранит до 255)
 * со счётчиком и, под `EXPO_PUBLIC_AI_ASSISTANT`, панель «Помощник автора». Панель
 * грузится отложенным чанком по литеральному флагу (#2738): без флага её кода нет в
 * сборке и запросов к `/ai/*` страница не делает. Поле уходит на сервер полным
 * `PUT /travels/upsert/` вместе с остальной формой (`api/misc.ts:saveFormData`): узкий
 * `PATCH /travels/{id}/content/` это поле не принимает.
 *
 * Вставка лида — первым абзацем описания: `<p>` с экранированным текстом дописывается
 * перед существующим HTML без разбора остального (ARTICLE-FORMAT-PRESERVATION-001).
 */

import React, { Suspense, useCallback, useMemo } from 'react';
import { Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import type { AiAuthorDraftKind } from '@/api/aiAssist/policy';
import type { AuthorAssistantPanelProps } from '@/components/travel/upsert/AuthorAssistantPanel';
import { translate as i18nT } from '@/i18n';
import type { TravelFormData } from '@/types/types';
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig';
import { escapeHtml } from '@/utils/htmlUtils';
import { htmlToPlainText } from '@/utils/seoText';
import { TRAVEL_META_DESCRIPTION_ANCHOR_ID, TRAVEL_META_DESCRIPTION_MAX_LENGTH } from '@/utils/travelFormUtils';

/** Сервер: `meta_description` CharField(255). */
export const META_DESCRIPTION_HARD_LIMIT = 255;

type PanelModule = { default: React.ComponentType<AuthorAssistantPanelProps> };
const EmptyPanel: React.ComponentType<AuthorAssistantPanelProps> = () => null;

const AuthorAssistantPanel = React.lazy<React.ComponentType<AuthorAssistantPanelProps>>(
    () =>
        (process.env.EXPO_PUBLIC_AI_ASSISTANT
            ? import('@/components/travel/upsert/AuthorAssistantPanel')
            : Promise.resolve({ default: EmptyPanel })) as Promise<PanelModule>,
);

/** Лид первым абзацем: текст экранируется, существующий HTML не разбирается и не меняется. */
export const prependLeadParagraph = (description: string | null | undefined, lead: string): string => {
    const paragraph = `<p>${escapeHtml(lead.trim())}</p>`;
    const existing = String(description ?? '');
    return existing.trim() ? `${paragraph}${existing}` : paragraph;
};

interface PublishSeoCardProps {
    colors: any;
    styles: any;
    formData: TravelFormData;
    setFormData: React.Dispatch<React.SetStateAction<TravelFormData>>;
    onLayout?: (event: LayoutChangeEvent) => void;
}

const PublishSeoCard: React.FC<PublishSeoCardProps> = ({ colors, styles, formData, setFormData, onLayout }) => {
    const value = String(formData.meta_description ?? '');
    const length = value.trim().length;
    const isOver = length > TRAVEL_META_DESCRIPTION_MAX_LENGTH;

    const handleChange = useCallback(
        (next: string) => {
            setFormData((prev) => ({ ...prev, meta_description: next }));
        },
        [setFormData],
    );

    const plainText = useMemo(() => htmlToPlainText(formData.description ?? ''), [formData.description]);

    const handleInsert = useCallback(
        (kind: AiAuthorDraftKind, variant: string) => {
            setFormData((prev) => {
                if (kind === 'title') return { ...prev, name: variant };
                if (kind === 'lead') return { ...prev, description: prependLeadParagraph(prev.description, variant) };
                return { ...prev, meta_description: variant };
            });
        },
        [setFormData],
    );

    return (
        <View style={[styles.card, styles.seoCard]} onLayout={onLayout} nativeID={TRAVEL_META_DESCRIPTION_ANCHOR_ID} testID="travel-publish-seo-card">
            <Text style={styles.cardTitle}>{i18nT('travel:components.travel.PublishSeoCard.title')}</Text>
            <Text style={styles.seoHint}>{i18nT('travel:components.travel.PublishSeoCard.hint')}</Text>
            <TextInput
                style={[styles.seoInput, isOver && styles.seoInputOver]}
                value={value}
                onChangeText={handleChange}
                multiline
                maxLength={META_DESCRIPTION_HARD_LIMIT}
                placeholder={i18nT('travel:components.travel.PublishSeoCard.placeholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={i18nT('travel:components.travel.PublishSeoCard.title')}
                testID="travel-publish-meta-description"
            />
            <View style={styles.seoCounterRow}>
                {isOver ? (
                    <Text style={styles.seoCounterWarning} testID="travel-publish-meta-description-over">
                        {i18nT('travel:components.travel.PublishSeoCard.counterOver', { value1: TRAVEL_META_DESCRIPTION_MAX_LENGTH })}
                    </Text>
                ) : <View />}
                <Text style={[styles.seoCounter, isOver && styles.seoCounterOver]} testID="travel-publish-meta-description-counter">
                    {i18nT('travel:components.travel.PublishSeoCard.counter', { value1: length, value2: TRAVEL_META_DESCRIPTION_MAX_LENGTH })}
                </Text>
            </View>
            {isAiAssistantEnabled() ? (
                <Suspense fallback={null}>
                    <AuthorAssistantPanel text={plainText} onInsert={handleInsert} />
                </Suspense>
            ) : null}
        </View>
    );
};

export default React.memo(PublishSeoCard);
