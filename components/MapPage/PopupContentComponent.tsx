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
        <button
          className="popup-close-btn"
          onClick={handleClose}
          aria-label="Закрыть карточку"
          title="Закрыть карточку (Esc)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="popup-content">
          <div className="popup-photo">
            {travelImageThumbUrl ? (
              <img
                src={travelImageThumbUrl}
                alt={address || 'Фото точки'}
                className="popup-photo-img"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // Если изображение не загрузилось, показываем placeholder
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const placeholder = target.parentElement?.querySelector('.popup-image-placeholder-fallback');
                  if (placeholder) {
                    (placeholder as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            {!travelImageThumbUrl && (
              <div className="popup-image-placeholder" aria-label="Нет фото для этой точки">
                <span className="popup-placeholder-icon" aria-hidden="true">📷</span>
                <span>Нет фотографии</span>
              </div>
            )}
            <div className="popup-image-placeholder popup-image-placeholder-fallback" style={{ display: 'none' }} aria-label="Нет фото для этой точки">
              <span className="popup-placeholder-icon" aria-hidden="true">📷</span>
              <span>Нет фотографии</span>
            </div>

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

            {cats[0] && (
              <div className="popup-photo-badge" aria-label="Категория локации">
                {cats[0]}
              </div>
            )}
          </div>

          <div className="popup-info">
            <div className="popup-info-header">
              <p className="popup-title" title={address}>{address}</p>
              <div
                className="popup-click-hint"
                title="Кликните на карточку, чтобы открыть подробную информацию"
              >
                👆 Открыть
              </div>
            </div>

            {coord && (
              <div className="popup-coord">
                <span className="popup-coord-label">Координаты</span>
                <button
                  type="button"
                  className="popup-coord-text"
                  aria-label="Скопировать координаты"
                  title="Нажмите, чтобы скопировать координаты"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCoord();
                  }}
                >
                  {coord}
                </button>
                {copied && <em className="popup-copied" aria-live="polite">✓ скопировано</em>}
              </div>
            )}

            {description ? (
              <div className="popup-description-wrapper">
                <p className="popup-description" title={description}>{description}</p>
                {description.length > 150 && (
                  <button 
                    className="popup-read-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      const desc = e.currentTarget.previousElementSibling as HTMLElement;
                      if (desc) {
                        desc.style.webkitLineClamp = desc.style.webkitLineClamp === '4' ? 'unset' : '4';
                        e.currentTarget.textContent = desc.style.webkitLineClamp === '4' ? 'Читать далее' : 'Свернуть';
                      }
                    }}
                  >
                    Читать далее
                  </button>
                )}
              </div>
            ) : null}

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
const CloseIcon = () => (
  <IconBase><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></IconBase>
);

/** Исправленные стили */
const styles = `
.popup-container {
  position: relative;
  margin: 0;
  padding: 0;
}

.popup-card {
  position: relative;
  width: min(560px, calc(100vw - 40px));
  min-width: 300px;
  border-radius: 20px;
  overflow: hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  cursor: pointer;
  background: #fff;
  box-shadow: 0 10px 40px rgba(0,0,0,0.18);
  outline: none;
  display: flex;
  flex-direction: column;
  transform: translateY(0);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.popup-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 55px rgba(0,0,0,0.22);
}

.popup-card:focus {
  box-shadow: 0 0 0 3px #0ea5e9, 0 10px 40px rgba(0,0,0,0.2);
}

.popup-content {
  display: flex;
  flex-direction: row;
  min-height: 240px;
}

.popup-content > * {
  min-height: 240px;
}

.popup-photo {
  position: relative;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
  border-right: 1px solid #e2e8f0;
  flex: 0 0 45%;
  min-width: 220px;
  background-color: #f1f5f9;
}

.popup-photo::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15,23,42,0.0) 30%, rgba(15,23,42,0.45) 100%);
  pointer-events: none;
}

.popup-photo-badge {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 2;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15,23,42,0.85);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  backdrop-filter: blur(6px);
}

.popup-image-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #475467;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.popup-placeholder-icon {
  font-size: 32px;
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
  background: rgba(0,0,0,0.55);
  border-radius: 12px;
  padding: 8px;
  backdrop-filter: blur(12px);
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

.popup-info {
  padding: 20px 22px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  flex: 1 1 55%;
}

.popup-info-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.popup-title {
  font-weight: 700;
  margin: 0;
  font-size: 19px;
  line-height: 1.35;
  color: #0f172a;
  flex: 1;
}

.popup-click-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ecfdf5;
  color: #047857;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  pointer-events: none;
  white-space: nowrap;
}

.popup-coord {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.popup-coord-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.popup-coord-text {
  border: 1px dashed #94a3b8;
  background: #f8fafc;
  color: #0f172a;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  appearance: none;
  -webkit-appearance: none;
}

.popup-coord-text:hover {
  background: #fff;
  border-color: #475569;
  box-shadow: 0 2px 6px rgba(15,23,42,0.08);
}

.popup-coord-text:focus-visible {
  outline: 2px solid #0ea5e9;
  outline-offset: 2px;
}

.popup-copied {
  color: #16a34a;
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
}

/* description and category styles stay unchanged */

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

.popup-svg {
  width: 20px;
  height: 20px;
  fill: #fff;
  display: block;
}

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

@media (max-width: 700px) {
  .popup-card {
    max-width: min(420px, calc(100vw - 24px));
  }

  .popup-content {
    flex-direction: column;
  }

  .popup-photo {
    min-height: 220px;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }

  .popup-info {
    padding: 16px 14px 16px;
  }

  .popup-close-btn {
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
  }
}

.popup-description-wrapper {
  position: relative;
}

.popup-description {
  color: #475467;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: all 0.3s ease;
}

.popup-read-more {
  margin-top: 8px;
  background: transparent;
  border: none;
  color: #0ea5e9;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}

.popup-read-more:hover {
  color: #0284c7;
}

.popup-photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.popup-photo:hover .popup-photo-img {
  transform: scale(1.05);
}

.popup-category-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.popup-category {
  background: #eef2ff;
  color: #312e81;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
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