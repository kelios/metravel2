// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react';

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.divIcon !== 'function') return null;
    if (typeof document === 'undefined') return null;

    const makeDivPin = (bg: string, ring: string) => {
      const safe = (v: string) => String(v).replace(/[^\w\s#(),.%-]/g, '').slice(0, 64);
      const bgSafe = safe(bg);
      const ringSafe = safe(ring);

      // Уникальный дизайн маркера metravel в форме капли/пина
      // Используем CSS для надежной отрисовки
      const html = `
        <div style="
          position: relative;
          width: 36px;
          height: 48px;
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 3px;
            width: 30px;
            height: 30px;
            background: ${bgSafe};
            border: 4px solid ${ringSafe};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          "></div>
          <div style="
            position: absolute;
            top: 8px;
            left: 11px;
            width: 14px;
            height: 14px;
            background: ${ringSafe};
            border-radius: 50%;
            z-index: 1;
          "></div>
          <div style="
            position: absolute;
            top: 11px;
            left: 14px;
            width: 8px;
            height: 8px;
            background: ${bgSafe};
            border-radius: 50%;
            z-index: 2;
          "></div>
        </div>
      `;

      return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [36, 48],
        iconAnchor: [18, 44],
        popupAnchor: [0, -46],
      });
    };

    return {
      meTravel: makeDivPin('#b5a88a', '#FFFFFF'),
      start: makeDivPin('#7a9d8a', '#FFFFFF'),
      end: makeDivPin('#a88a8a', '#FFFFFF'),
      userLocation: makeDivPin('#8a9aa8', '#FFFFFF'),
    };
  }, [L]);
};
