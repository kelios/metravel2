// components/travel/PopupContentWeb.tsx
import React, { useCallback, memo, useEffect, useRef, useState } from 'react';

interface Travel {
  address: string;
  coord: string; // "lat,lng"
  travelImageThumbUrl?: string;
  categoryName?: string;   // "cat1, cat2"
  description?: string;
  articleUrl?: string;
  urlTravel?: string;      // роут на квест
}

interface PopupContentWebProps {
  travel: Travel;
}

const parseLatLng = (coord: string): { lat: number; lng: number } | null => {
  if (!coord) return null;
  const cleaned = coord.replace(/;/g, ',').replace(/\s+/g, '');
  const [latS, lngS] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latS), lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const PopupContentWeb: React.FC<PopupContentWebProps> = memo(({ travel }) => {
  const { address, coord, travelImageThumbUrl, categoryName, description, articleUrl, urlTravel } = travel;
  const [copied, setCopied] = useState(false);
  const mounted = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const safeOpen = useCallback((url?: string) => {
    if (!url) return;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openPrimary = useCallback(() => { safeOpen(urlTravel || articleUrl); }, [urlTravel, articleUrl, safeOpen]);

  const copyCoord = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(coord);
        if (mounted.current) { setCopied(true); setTimeout(() => setCopied(false), 1200); }
      }
    } catch { /* no-op */ }
  }, [coord]);

  const openMap = useCallback(() => {
    const p = parseLatLng(coord);
    if (!p) return;
    safeOpen(`https://maps.google.com/?q=${encodeURIComponent(`${p.lat},${p.lng}`)}`);
  }, [coord, safeOpen]);

  const shareTelegram = useCallback(() => {
    const base = urlTravel || `https://maps.google.com/?q=${encodeURIComponent(coord)}`;
    const text = `Координаты: ${coord}${address ? ` — ${address}` : ''}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(base)}&text=${encodeURIComponent(text)}`;
    safeOpen(url);
  }, [coord, address, urlTravel, safeOpen]);

  const handleAction = useCallback((e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPrimary(); }
  }, [openPrimary]);

  const cats = (categoryName || '').split(',').map(c => c.trim()).filter(Boolean);

  return (
    <div
      className="popup-card"
      onClick={openPrimary}
      onKeyDown={onKey}
      tabIndex={0}
      role="button"
      aria-label={`Открыть: ${address}`}
      title="Открыть"
    >
      <div
        className="popup-image"
        style={{
          backgroundImage: travelImageThumbUrl ? `url(${travelImageThumbUrl})` : 'none',
          backgroundColor: travelImageThumbUrl ? undefined : '#e0e0e0'
        }}
      >
        <div className="popup-icons-top" aria-label="Действия с точкой">
          <div className="popup-icons-group">
            <button className="popup-icon-btn" onClick={(e) => handleAction(e, copyCoord)} title="Скопировать координаты" aria-label="Скопировать координаты">
              <CopyIcon />
            </button>
            <button className="popup-icon-btn" onClick={(e) => handleAction(e, shareTelegram)} title="Поделиться в Telegram" aria-label="Поделиться в Telegram">
              <SendIcon />
            </button>
            <button className="popup-icon-btn" onClick={(e) => handleAction(e, openMap)} title="Открыть на карте" aria-label="Открыть на карте">
              <MapPinIcon />
            </button>
            {(urlTravel || articleUrl) && (
              <button className="popup-icon-btn" onClick={(e) => handleAction(e, openPrimary)} title={urlTravel ? 'Открыть квест' : 'Открыть статью'} aria-label={urlTravel ? 'Открыть квест' : 'Открыть статью'}>
                <LinkIcon />
              </button>
            )}
          </div>
        </div>

        <div className="popup-overlay">
          <div className="popup-text">
            <p className="popup-title one-line" title={address}>{address}</p>

            {coord && (
              <div className="popup-coord">
                {/* делаем выделяемым текстом без клика, чтобы легко копировать мышью */}
                <span className="popup-coord-text" aria-label="Координаты" title="Выделите и скопируйте">
                  {coord}
                </span>
                {copied && <em className="popup-copied" aria-live="polite">скопировано</em>}
              </div>
            )}

            {description ? <p className="popup-description">{description}</p> : null}

            {cats.length > 0 ? (
              <div className="popup-category-container">
                {cats.map((cat, i) => (
                  <span key={`${cat}-${i}`} className="popup-category">{cat}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

const IconBase: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" className="popup-svg" aria-hidden="true">{children}</svg>
);

const LinkIcon = () => (
  <IconBase><path d="M3.9,12A5.1,5.1,0,0,1,9,6.9h3v1.8H9A3.3,3.3,0,0,0,5.7,12,3.3,3.3,0,0,0,9,15.3h3v1.8H9A5.1,5.1,0,0,1,3.9,12Zm11.1-.9H9.9v1.8h5.1ZM15,6.9h-3v1.8h3A3.3,3.3,0,0,1,18.3,12,3.3,3.3,0,0,1,15,15.3h-3v1.8h3A5.1,5.1,0,0,0,20.1,12,5.1,5.1,0,0,0,15,6.9Z"/></IconBase>
);
const CopyIcon = () => (
  <IconBase><path d="M16,1H4A2,2,0,0,0,2,3V15H4V3H16ZM20,5H8A2,2,0,0,0,6,7V21a2,2,0,0,0,2,2H20a2,2,0,0,0,2-2V7A2,2,0,0,0,20,5Zm0,16H8V7H20Z"/></IconBase>
);
const SendIcon = () => (
  <IconBase><path d="M2.01,21L23,12,2.01,3,2,10l15,2-15,2Z"/></IconBase>
);
const MapPinIcon = () => (
  <IconBase><path d="M12 2C8.7 2 6 4.7 6 8c0 4.2 5.3 10.4 5.6 10.8.2.3.6.3.8 0 .3-.4 5.6-6.6 5.6-10.8 0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 5.5 12 5.5s2.5 1.1 2.5 2.5S13.4 10.5 12 10.5z"/></IconBase>
);

/** Компактные стили + белые координаты + выделение текста */
const styles = `
.popup-card {
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  overflow: hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  cursor: pointer;
  background: #fff;
  box-shadow: 0 6px 28px rgba(0,0,0,0.16);
  outline: none;
  display: inline-block;
}
.popup-card:focus { box-shadow: 0 0 0 2px #0ea5e9, 0 6px 28px rgba(0,0,0,0.16); }

.popup-image {
  position: relative;
  min-height: 260px;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.popup-icons-top { position: absolute; top: 8px; right: 8px; z-index: 2; }
.popup-icons-group {
  display: flex; gap: 4px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px; padding: 4px;
}
.popup-icon-btn { background: transparent; border: none; padding: 4px; border-radius: 6px; cursor: pointer; }
.popup-icon-btn:hover { background: rgba(255,255,255,0.08); }

.popup-overlay { width: 100%;
 background: rgba(0,0,0,0.6); 
 padding: 5px;
 box-sizing: border-box; }

.popup-text { color: #fff; font-size: 13px; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }

.popup-title { font-weight: 700; margin: 0 0 4px 0; font-size: 16px; }
.one-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.popup-coord { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.popup-coord-text {
  color: #ffffff;              /* белые координаты */
  user-select: text;           /* можно выделять */
  -webkit-user-select: text;
  text-decoration: none;
  font-weight: 600;
}
.popup-copied { opacity: .95; font-style: italic; font-size: 12px; }

.popup-description { color: #fff; font-size: 13px; line-height: 1.35; margin: 0 0 6px 0; }

.popup-category-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.popup-category {
  background: rgba(255,255,255,0.22);
  border-radius: 999px;
  padding: 3px 8px;            /* компактнее */
  font-size: 12px; font-weight: 600; color: #fff;
}

.popup-svg { width: 20px; height: 20px; fill: #fff; }
@media (min-width: 600px) { .popup-image { min-height: 280px; } .popup-title { font-size: 16px; } }
@media (min-width: 1024px) { .popup-image { min-height: 300px; } .popup-title { font-size: 17px; } }
`;

if (typeof document !== 'undefined') {
  const id = 'popup-content-web-style';
  if (!document.getElementById(id)) {
    const styleTag = document.createElement('style');
    styleTag.id = id;
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
  }
}

export default PopupContentWeb;
