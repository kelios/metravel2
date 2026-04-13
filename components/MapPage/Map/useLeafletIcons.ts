// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.divIcon !== 'function') return null;
    if (typeof document === 'undefined') return null;

    const makeDivPin = (bg: string) => {
      const safe = (v: string) => String(v).replace(/[^\w\s#(),.%-]/g, '').slice(0, 64);
      const bgSafe = safe(bg);

      const html = `
        <div style="
          position: relative;
          width: 36px;
          height: 50px;
          box-sizing: border-box;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(0 10px 18px rgba(61, 45, 22, 0.22));
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 50%;
            width: 28px;
            height: 28px;
            transform: translateX(-50%) rotate(-45deg);
            transform-origin: 50% 50%;
            background:
              radial-gradient(circle at 32% 28%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.10) 24%, rgba(255,255,255,0) 48%),
              linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 56%),
              ${bgSafe};
            border: 2px solid rgba(255,255,255,0.92);
            outline: none;
            border-radius: 50% 50% 50% 0;
            box-shadow:
              0 8px 18px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.30);
            box-sizing: border-box;
          "></div>
          <div style="
            position: absolute;
            top: 8px;
            left: 50%;
            width: 14px;
            height: 14px;
            margin-left: -7px;
            background: rgba(255,255,255,0.96);
            border-radius: 50%;
            z-index: 1;
            box-sizing: border-box;
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.72);
          "></div>
          <div style="
            position: absolute;
            top: 11px;
            left: 50%;
            width: 7px;
            height: 7px;
            margin-left: -3.5px;
            background: ${bgSafe};
            border-radius: 50%;
            z-index: 2;
            box-sizing: border-box;
          "></div>
          <div style="
            position: absolute;
            top: 4px;
            left: 50%;
            width: 12px;
            height: 6px;
            margin-left: -6px;
            background: rgba(255,255,255,0.42);
            border-radius: 999px;
            transform: rotate(-20deg);
            z-index: 3;
            filter: blur(0.2px);
            box-sizing: border-box;
          "></div>
          <div style="
            position: absolute;
            left: 50%;
            bottom: 2px;
            width: 14px;
            height: 14px;
            margin-left: -7px;
            border-radius: 999px;
            background: rgba(255, 164, 66, 0.16);
            filter: blur(4px);
            z-index: 0;
          "></div>
        </div>
      `;

      return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [36, 50],
        iconAnchor: [18, 46],
        popupAnchor: [10, 5],
      });
    };

    return {
      meTravel: makeDivPin(DESIGN_TOKENS.colors.mapPin),
      start: makeDivPin(DESIGN_TOKENS.colors.success),
      end: makeDivPin(DESIGN_TOKENS.colors.dangerDark),
      userLocation: makeDivPin(DESIGN_TOKENS.colors.accent),
    };
  }, [L]);
};
