// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react';

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.divIcon !== 'function') return null;
    if (typeof document === 'undefined') return null;

    const makeDivPin = (bg: string) => {
      const safe = (v: string) => String(v).replace(/[^\w\s#(),.%-]/g, '').slice(0, 64);
      const bgSafe = safe(bg);

      // Уникальный дизайн маркера metravel в форме капли/пина
      // Используем CSS для надежной отрисовки
      const html = `
        <div style="
          position: relative;
          width: 34px;
          height: 46px;
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 4px;
            width: 26px;
            height: 26px;
            background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), ${bgSafe};
            border: none;
            outline: none;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 8px 18px rgba(0,0,0,0.18);
          "></div>
          <div style="
            position: absolute;
            top: 9px;
            left: 12px;
            width: 10px;
            height: 10px;
            background: rgba(255,255,255,0.96);
            border-radius: 50%;
            z-index: 1;
          "></div>
          <div style="
            position: absolute;
            top: 11px;
            left: 14px;
            width: 6px;
            height: 6px;
            background: ${bgSafe};
            border-radius: 50%;
            z-index: 2;
          "></div>
          <div style="
            position: absolute;
            top: 4px;
            left: 10px;
            width: 10px;
            height: 6px;
            background: rgba(255,255,255,0.35);
            border-radius: 999px;
            transform: rotate(-20deg);
            z-index: 3;
            filter: blur(0.2px);
          "></div>
        </div>
      `;

      return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [34, 46],
        iconAnchor: [17, 42],
        popupAnchor: [0, -44],
      });
    };

    return {
      meTravel: makeDivPin('#FF8A00'),
      start: makeDivPin('#7a9d8a'),
      end: makeDivPin('#a88a8a'),
      userLocation: makeDivPin('#8a9aa8'),
    };
  }, [L]);
};
