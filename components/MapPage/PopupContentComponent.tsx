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
  onClose?: () => void; // Добавляем проп для закрытия
}

const parseLatLng = (coord: string): { lat: number; lng: number } | null => {
  if (!coord) return null;
  const cleaned = coord.replace(/;/g, ',').replace(/\s+/g, '');
  const [latS, lngS] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latS), lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const PopupContentWeb: React.FC<PopupContentWebProps> = memo(({ travel, onClose }) => {
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

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose?.();
  }, [onClose]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPrimary(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  }, [openPrimary, onClose]);

  const cats = (categoryName || '').split(',').map(c => c.trim()).filter(Boolean);

  return (
    <div
      className="popup-container"
      onClick={openPrimary}
      onKeyDown={onKey}
      tabIndex={0}
      role="button"
      aria-label={`Открыть: ${address}`}
      title="Открыть"
    >
      <div className="popup-card">
        {/* Крестик закрытия */}
        <button
          className="popup-close-btn"
          onClick={handleClose}
          aria-label="Закрыть карточку"
          title="Закрыть карточку (Esc)"
        >
          {/* Иконка крестика */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        
        {/* Подсказка о клике на карточку */}
        <div className="popup-click-hint" title="Кликните на карточку, чтобы открыть подробную информацию">
          👆 Кликните, чтобы открыть
        </div>

        <div
          className="popup-image"
          style={{
            backgroundImage: travelImageThumbUrl ? `url(${travelImageThumbUrl})` : 'none',
            backgroundColor: travelImageThumbUrl ? undefined : '#e0e0e0'
          }}
        >
          <div className="popup-icons-top" aria-label="Действия с точкой">
            <div className="popup-icons-group">
              <button 
                className="popup-icon-btn popup-icon-btn-with-label" 
                onClick={(e) => handleAction(e, copyCoord)} 
                title="Скопировать координаты в буфер обмена" 
                aria-label="Скопировать координаты"
              >
                <CopyIcon />
                <span className="popup-icon-label">Копировать</span>
              </button>
              <button 
                className="popup-icon-btn popup-icon-btn-with-label" 
                onClick={(e) => handleAction(e, shareTelegram)} 
                title="Поделиться в Telegram" 
                aria-label="Поделиться в Telegram"
              >
                <SendIcon />
                <span className="popup-icon-label">Telegram</span>
              </button>
              <button 
                className="popup-icon-btn popup-icon-btn-with-label" 
                onClick={(e) => handleAction(e, openMap)} 
                title="Открыть это место в Google Maps" 
                aria-label="Открыть на карте"
              >
                <MapPinIcon />
                <span className="popup-icon-label">Карта</span>
              </button>
            </div>
          </div>

          <div className="popup-overlay">
            <div className="popup-text">
              <p className="popup-title one-line" title={address}>{address}</p>

              {coord && (
                <div className="popup-coord">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ 
                      fontSize: '11px', 
                      color: 'rgba(255,255,255,0.8)',
                      fontWeight: '500'
                    }}>
                      📍 Координаты:
                    </span>
                  </div>
                  <span 
                    className="popup-coord-text" 
                    aria-label="Координаты" 
                    title="Нажмите на кнопку выше, чтобы скопировать координаты"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCoord();
                    }}
                  >
                    {coord}
                  </span>
                  {copied && <em className="popup-copied" aria-live="polite">✓ скопировано</em>}
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
const CloseIcon = () => (
  <IconBase><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></IconBase>
);

/** Исправленные стили */
const styles = `
/* Контейнер для попапа */
.popup-container {
  position: relative;
  margin: 0;
  padding: 0;
}

.popup-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  min-width: 300px;
  border-radius: 16px;
  overflow: hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  cursor: pointer;
  background: #fff;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  outline: none;
  margin: 0;
  transform: translateY(0);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.popup-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 50px rgba(0,0,0,0.25);
}

.popup-card:focus { 
  box-shadow: 0 0 0 3px #0ea5e9, 0 10px 40px rgba(0,0,0,0.2); 
}

/* Крестик закрытия */
.popup-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.popup-close-btn:hover {
  background: rgba(0,0,0,0.7);
  transform: scale(1.1);
}

.popup-close-btn .popup-svg {
  width: 18px;
  height: 18px;
  fill: #fff;
}

.popup-click-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 152, 0, 0.9);
  color: #fff;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.popup-card:hover .popup-click-hint {
  opacity: 1;
}

.popup-image {
  position: relative;
  min-height: 220px;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.popup-icons-top { 
  position: absolute; 
  top: 12px; 
  left: 12px; 
  z-index: 2; 
}

.popup-icons-group {
  display: flex; 
  gap: 6px;
  background: rgba(0,0,0,0.5);
  border-radius: 12px; 
  padding: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.popup-icon-btn { 
  background: transparent; 
  border: none; 
  padding: 6px; 
  border-radius: 6px; 
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;
}

.popup-icon-btn:hover { 
  background: rgba(255,255,255,0.2); 
  transform: scale(1.05);
}

.popup-icon-btn-with-label {
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  min-width: 60px;
}

.popup-icon-label {
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  white-space: nowrap;
  line-height: 1;
  margin-top: 2px;
}

.popup-overlay { 
  width: 100%;
  background: linear-gradient(transparent 0%, rgba(0,0,0,0.85) 100%);
  padding: 20px 16px 16px;
  box-sizing: border-box;
}

.popup-text { 
  color: #fff; 
  font-size: 14px; 
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  width: 100%;
}

.popup-title { 
  font-weight: 700; 
  margin: 0 0 10px 0; 
  font-size: 18px; 
  line-height: 1.2;
}

.one-line { 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  display: block;
}

.popup-coord { 
  margin-bottom: 10px; 
  display: flex; 
  align-items: center; 
  gap: 8px;
  flex-wrap: wrap;
}

.popup-coord-text {
  color: #ffffff;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: rgba(255,255,255,0.2);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-block;
}

.popup-coord-text:hover {
  background: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.5);
  transform: scale(1.02);
}

.popup-copied { 
  opacity: 0.95; 
  font-style: italic; 
  font-size: 12px; 
  color: #10b981;
  font-weight: 500;
}

.popup-description { 
  color: rgba(255,255,255,0.95); 
  font-size: 14px; 
  line-height: 1.5; 
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.popup-category-container { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 8px; 
  margin-top: 12px;
}

.popup-category {
  background: rgba(255,255,255,0.25);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px; 
  font-weight: 600; 
  color: #fff;
  line-height: 1;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.popup-svg { 
  width: 20px; 
  height: 20px; 
  fill: #fff; 
  display: block;
}

/* Восстанавливаем стандартные стили Leaflet */
.leaflet-popup-content-wrapper {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

.leaflet-popup-content {
  margin: 0 !important;
  padding: 0 !important;
  min-height: auto !important;
}

/* Скрываем стандартную кнопку закрытия Leaflet */
.leaflet-popup-close-button {
  display: none !important;
}

.leaflet-popup-tip-container {
  display: block !important;
}

.leaflet-popup-tip {
  background: #fff !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
}

/* Адаптивность */
@media (max-width: 480px) {
  .popup-card {
    max-width: 320px;
    min-width: 280px;
  }
  
  .popup-image {
    min-height: 200px;
  }
  
  .popup-overlay {
    padding: 16px 12px 12px;
  }
  
  .popup-title {
    font-size: 16px;
  }
  
  .popup-close-btn {
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
  }
}

@media (min-width: 768px) {
  .popup-image {
    min-height: 240px;
  }
}

@media (min-width: 1024px) {
  .popup-image {
    min-height: 260px;
  }
  
  .popup-card {
    max-width: 440px;
  }
}
`;

// Безопасное добавление стилей
if (typeof document !== 'undefined') {
  const id = 'popup-content-web-style';
  let styleTag = document.getElementById(id) as HTMLStyleElement;

  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = id;
    document.head.appendChild(styleTag);
  }

  if (styleTag.innerHTML !== styles) {
    styleTag.innerHTML = styles;
  }
}

export default PopupContentWeb;