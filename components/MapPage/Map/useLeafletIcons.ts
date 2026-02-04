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

      // Уникальный дизайн маркера metravel в форме капли/пина.
      // Важно: внутреннюю «каплю» центрируем через translateX(-50%),
      // иначе на разных браузерах появлялись смещения (особенно заметно на start/end).
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
            background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), ${bgSafe};
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
            background: ${bgSafe};
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
        // Anchor внизу по центру ("носик" пина)
        iconAnchor: [17, 42],
        popupAnchor: [0, -44],
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
