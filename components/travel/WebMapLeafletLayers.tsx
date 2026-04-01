import React, { useEffect, useRef } from 'react';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const hasValidMarkerCoordinates = (marker: any) =>
    Number.isFinite(marker?.lat) &&
    Number.isFinite(marker?.lng) &&
    marker.lat >= -90 &&
    marker.lat <= 90 &&
    marker.lng >= -180 &&
    marker.lng <= 180;

export const createMarkerIcon = (L: any, bg: string) => {
    if (!L || typeof L.divIcon !== 'function') return null;

    const html = `
      <div style="
        position: relative;
        width: 34px;
        height: 46px;
        box-sizing: border-box;
        pointer-events: none;
        user-select: none;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 50%;
          width: 26px;
          height: 26px;
          transform: translateX(-50%) rotate(-45deg);
          transform-origin: 50% 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), ${bg};
          border: none;
          outline: none;
          border-radius: 50% 50% 50% 0;
          box-shadow: 0 8px 18px rgba(0,0,0,0.18);
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          top: 9px;
          left: 50%;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          background: rgba(255,255,255,0.96);
          border-radius: 50%;
          z-index: 1;
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          top: 11px;
          left: 50%;
          width: 6px;
          height: 6px;
          margin-left: -3px;
          background: ${bg};
          border-radius: 50%;
          z-index: 2;
          box-sizing: border-box;
        "></div>
        <div style="
          position: absolute;
          top: 4px;
          left: 50%;
          width: 10px;
          height: 6px;
          margin-left: -5px;
          background: rgba(255,255,255,0.35);
          border-radius: 999px;
          transform: rotate(-20deg);
          z-index: 3;
          filter: blur(0.2px);
          box-sizing: border-box;
        "></div>
      </div>
    `;

    return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [34, 46],
        iconAnchor: [17, 42],
        popupAnchor: [0, -41],
    });
};

type CenterOnActiveProps = {
    activeIndex: number | null;
    markers: any[];
    useMapHook: () => any;
    activeSetByMarkerClickRef: React.MutableRefObject<boolean>;
};

export function CenterOnActive({
    activeIndex,
    markers,
    useMapHook,
    activeSetByMarkerClickRef,
}: CenterOnActiveProps) {
    const map = useMapHook();
    const prevActiveIndexRef = useRef<number | null>(null);
    const hasCenteredRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (activeIndex == null) return;

        if (activeSetByMarkerClickRef.current) {
            activeSetByMarkerClickRef.current = false;
            prevActiveIndexRef.current = activeIndex;
            return;
        }

        if (prevActiveIndexRef.current === activeIndex) return;

        const marker = markers[activeIndex];
        if (!hasValidMarkerCoordinates(marker)) return;

        const lat = Number(marker.lat);
        const lng = Number(marker.lng);
        prevActiveIndexRef.current = activeIndex;

        const markerKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        if (hasCenteredRef.current.has(markerKey)) return;
        hasCenteredRef.current.add(markerKey);

        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
        const nextZoom = Math.max(currentZoom, 14);
        map.setView([lat, lng], nextZoom, { animate: true });
    }, [activeIndex, markers, map, activeSetByMarkerClickRef]);

    return null;
}

type FitBoundsProps = {
    markers: any[];
    initialFitAllowed: boolean;
    useMapHook: () => any;
    L: any;
};

export function FitBounds({ markers, initialFitAllowed, useMapHook, L }: FitBoundsProps) {
    const map = useMapHook();
    const hasFit = useRef(false);

    useEffect(() => {
        if (!initialFitAllowed || hasFit.current || markers.length === 0) return;

        const validMarkers = markers.filter(hasValidMarkerCoordinates);
        if (validMarkers.length === 0) return;

        const bounds = L.latLngBounds(validMarkers.map((m: any) => [m.lat, m.lng]));
        if (!bounds.isValid()) return;

        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
        hasFit.current = true;
    }, [L, initialFitAllowed, map, markers]);

    return null;
}

type MapClickHandlerProps = {
    addMarker: (latlng: any) => void;
    useMapEventsHook: (handlers: any) => any;
};

export function MapClickHandler({ addMarker, useMapEventsHook }: MapClickHandlerProps) {
    useMapEventsHook({
        click(e: any) {
            addMarker(e.latlng);
        },
    });

    return null;
}

export const mapHeightStyle = (isWideLayout: boolean) => ({
    height: isWideLayout ? 600 : 460,
    width: '100%',
});

export const loadingStyle = (colors: any) => ({
    padding: DESIGN_TOKENS.spacing.lg,
    color: colors.textMuted,
});
