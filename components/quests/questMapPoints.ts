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
};

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
        });
    });

    return Array.from(grouped.values()).sort(
        (left, right) => Math.min(...left.indexes) - Math.min(...right.indexes),
    );
}
