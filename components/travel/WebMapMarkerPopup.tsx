import React from 'react';
import type Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';

import PlacePopupCard from '@/components/MapPage/Map/PlacePopupCard';
import {
    buildAppleMapsUrl,
    buildGoogleMapsUrl,
    buildOpenStreetMapUrl,
    buildOrganicMapsUrl,
    buildTelegramShareUrl,
    buildWazeUrl,
    buildYandexMapsUrl,
    buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks';
import type { ThemedColors } from '@/hooks/useTheme';
import { getTravelPointImageUrl } from '@/utils/travelPointImages';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'


type WebMapMarkerPopupProps = {
    marker: any;
    markerIndex: number;
    categoryTravelAddress: any[];
    colors: ThemedColors;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
    /** Closes the surrounding Leaflet popup (wired by WebMapComponent via map.closePopup). */
    onClose?: () => void;
};

type WizardPopupAction = {
    key: string;
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    accessibilityLabel?: string;
    tooltip?: string;
};

const openExternal = async (
    url: string,
    errorText: string,
) => {
    if (!url) return;
    const opened = await openExternalUrlInNewTab(url);
    if (!opened) void showToast({ type: 'info', text1: errorText, position: 'bottom' });
};

/**
 * FE-MAP M4 — the travel-wizard point popup now renders the canonical
 * `PlacePopupCard` (same hero/contain+blur photo, coord + copy, navigation set and
 * i18n contract as the main map / «Мои точки» popups) instead of a bespoke DOM
 * template. Wizard-specific intents («Редактировать» / «Удалить») are surfaced as
 * `extraActions`; the map-app CTA fallback is suppressed so navigation stays in the
 * «Навигация и действия» sheet. Native quest/travel popups are a separate engine
 * (deferred to #990).
 */
export default function WebMapMarkerPopup({
    marker,
    markerIndex,
    categoryTravelAddress,
    colors,
    onEdit,
    onRemove,
    onClose,
}: WebMapMarkerPopupProps) {
    const imageUrl = getTravelPointImageUrl(marker.image) || null;

    const lat = Number(marker?.lat);
    const lng = Number(marker?.lng);
    const coord = React.useMemo(
        () => (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''),
        [lat, lng],
    );

    const title = React.useMemo(() => {
        const address = String(marker?.address ?? '').trim();
        return address || i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a');
    }, [marker?.address]);

    const categoryLabel = React.useMemo(() => {
        const ids = Array.isArray(marker?.categories) ? marker.categories : [];
        const names = ids
            .map((catId: any) => {
                const targetId = String(catId);
                const found = categoryTravelAddress.find((c: any) => String(c.id) === targetId);
                return found?.name ?? null;
            })
            .filter(Boolean);
        return names.length > 0 ? names.join(', ') : null;
    }, [marker?.categories, categoryTravelAddress]);

    const handleCopyCoord = React.useCallback(async () => {
        if (!coord) return;
        try {
            await Clipboard.setStringAsync(coord);
            void showToast({ type: 'success', text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.koordinaty_skopirovany_9794ecb0'), position: 'bottom' });
        } catch {
            void showToast({ type: 'error', text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_skopirovat_koordinaty_251cf34d'), position: 'bottom' });
        }
    }, [coord]);

    const handleShareTelegram = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildTelegramShareUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_podelitsya_1ff7407d'));
    }, [coord]);

    const handleOpenGoogleMaps = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildGoogleMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_google_maps_a2ca522b'));
    }, [coord]);

    const handleOpenAppleMaps = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildAppleMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_apple_maps_c57c17b9'));
    }, [coord]);

    const handleOpenOrganicMaps = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildOrganicMapsUrl(coord, title), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_organic_maps_87cc6b2d'));
    }, [coord, title]);

    const handleOpenWaze = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildWazeUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_waze_d35ab6c9'));
    }, [coord]);

    const handleOpenYandexMaps = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildYandexMapsUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_yandeks_karty_860260b8'));
    }, [coord]);

    const handleOpenYandexNavi = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildYandexNaviUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_yandeks_navigator_d112999a'));
    }, [coord]);

    const handleOpenOpenStreetMap = React.useCallback(() => {
        if (!coord) return;
        void openExternal(buildOpenStreetMapUrl(coord), i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_otkryt_openstreetmap_342ea6e3'));
    }, [coord]);

    const handleEdit = React.useCallback(() => {
        onClose?.();
        onEdit(markerIndex);
    }, [markerIndex, onClose, onEdit]);

    const handleRemove = React.useCallback(() => {
        onClose?.();
        onRemove(markerIndex);
    }, [markerIndex, onClose, onRemove]);

    const extraActions = React.useMemo<WizardPopupAction[]>(() => [
        {
            key: 'edit',
            label: i18nT('travel:components.travel.WebMapMarkerPopup.redaktirovat_6064d6d1'),
            icon: 'edit-2',
            onPress: handleEdit,
            accessibilityLabel: i18nT('travel:components.travel.WebMapMarkerPopup.redaktirovat_6064d6d1'),
            tooltip: i18nT('travel:components.travel.WebMapMarkerPopup.redaktirovat_6064d6d1'),
        },
        {
            key: 'delete',
            label: i18nT('map:components.UserPoints.UserPointsMapPointMarker.udalit_976107ea'),
            icon: 'trash-2',
            onPress: handleRemove,
            accessibilityLabel: i18nT('map:components.UserPoints.UserPointsMapPointMarker.udalit_976107ea'),
            tooltip: i18nT('map:components.UserPoints.UserPointsMapPointMarker.udalit_976107ea'),
        },
    ], [handleEdit, handleRemove]);

    return (
        <PlacePopupCard
            colors={colors}
            title={title}
            imageUrl={imageUrl}
            categoryLabel={categoryLabel}
            coord={coord || null}
            onCopyCoord={handleCopyCoord}
            onShareTelegram={handleShareTelegram}
            onOpenGoogleMaps={handleOpenGoogleMaps}
            onOpenAppleMaps={handleOpenAppleMaps}
            onOpenOrganicMaps={handleOpenOrganicMaps}
            onOpenWaze={handleOpenWaze}
            onOpenYandexMaps={handleOpenYandexMaps}
            onOpenYandexNavi={handleOpenYandexNavi}
            onOpenOpenStreetMap={handleOpenOpenStreetMap}
            extraActions={extraActions}
            suppressFallbackPrimaryAction
            onClose={onClose}
        />
    );
}
