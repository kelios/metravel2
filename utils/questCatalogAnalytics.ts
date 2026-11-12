// Клик по карточке каталога квестов (#3228): мерить «клик / показ» по
// порядку выдачи. Согласие проверяет сам sendAnalyticsEvent.

import { sendAnalyticsEvent } from '@/utils/analytics';
import type { QuestCatalogOrderKind } from '@/utils/questVisitorOrder';

export const QUEST_CATALOG_CARD_CLICK_EVENT = 'quest_catalog_card_click';

export function trackQuestCatalogCardClick(params: {
    questId: string;
    /** Позиция карточки в выдаче, с нуля. */
    position: number;
    order: QuestCatalogOrderKind;
}): void {
    void sendAnalyticsEvent(QUEST_CATALOG_CARD_CLICK_EVENT, {
        quest_id: params.questId,
        position: params.position,
        catalog_order: params.order,
    });
}
