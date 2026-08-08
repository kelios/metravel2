import { toFiniteCoordinate } from '@/utils/webViewBridge';

export type QuestStepPoint = {
    lat: number;
    lng: number;
    title?: string;
};

export type GroupedQuestPoint = {
    lat: number;
    lng: number;
    indexes: number[];
    titles: string[];
    /** Leaflet offset: earlier quest points stay visible above later nearby points. */
    zIndexOffset: number;
};

const QUEST_MARKER_Z_INDEX_BASE = 10_000;
const QUEST_MARKER_Z_INDEX_STEP = 100;

export const ACTIVE_QUEST_MARKER_Z_INDEX_OFFSET = 20_000;

export function getQuestMarkerZIndexOffset(pointNumbers: readonly number[]): number {
    const firstPointNumber = pointNumbers.reduce(
        (first, value) => Number.isFinite(value) ? Math.min(first, value) : first,
        Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(firstPointNumber)) return QUEST_MARKER_Z_INDEX_BASE;
    return QUEST_MARKER_Z_INDEX_BASE - Math.max(0, firstPointNumber) * QUEST_MARKER_Z_INDEX_STEP;
}

export function normalizeQuestStepPoints(steps: readonly QuestStepPoint[]): QuestStepPoint[] {
    return steps.filter((step) => toFiniteCoordinate(step.lat, step.lng) !== null);
}

export function groupQuestStepPoints(
    points: readonly QuestStepPoint[],
    getFallbackTitle: (pointNumber: number) => string,
): GroupedQuestPoint[] {
    const grouped = new Map<string, GroupedQuestPoint>();

    points.forEach((point, index) => {
        const pointNumber = index + 1;
        const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
        const title = point.title || getFallbackTitle(pointNumber);
        const existing = grouped.get(key);

        if (existing) {
            existing.indexes.push(pointNumber);
            existing.titles.push(title);
            return;
        }

        grouped.set(key, {
            lat: point.lat,
            lng: point.lng,
            indexes: [pointNumber],
            titles: [title],
            zIndexOffset: getQuestMarkerZIndexOffset([pointNumber]),
        });
    });

    return Array.from(grouped.values()).sort(
        (left, right) => Math.min(...left.indexes) - Math.min(...right.indexes),
    );
}
