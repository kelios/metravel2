// components/travel/PopupContentWeb.tsx
import React, { useCallback, memo, useEffect, useRef, useState, useMemo } from 'react';
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { useThemedColors } from '@/hooks/useTheme';

interface Travel {
  address: string;
  coord: string; // "lat,lng"
  travelImageThumbUrl?: string;
  updated_at?: string;
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
  const parsed = CoordinateConverter.fromLooseString(coord);
  return parsed ? { lat: parsed.lat, lng: parsed.lng } : null;
};

const PopupContentWeb: React.FC<PopupContentWebProps> = memo(({ travel, onClose }) => {
  const colors = useThemedColors();
  const { address, coord, travelImageThumbUrl, updated_at, categoryName, description, articleUrl, urlTravel } = travel;
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const mounted = useRef(false);
  const loggedImageErrorsRef = useRef<Set<string>>(new Set());

  // Optimize and version the image URL
  const optimizedImageUrl = useMemo(() => {
    if (!travelImageThumbUrl) {
      return undefined;
    }
    
    // Create versioned URL
    const versionedUrl = buildVersionedImageUrl(travelImageThumbUrl, updated_at);
    
    // Optimal size for popup images
    const optimalSize = getOptimalImageSize(640, 480);
    
    const optimized = optimizeImageUrl(versionedUrl, {
      width: optimalSize.width,
      height: optimalSize.height,
      format: 'webp',
      quality: 82,
      fit: 'contain',
    }) || versionedUrl;

    return optimized;
  }, [travelImageThumbUrl, updated_at]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const safeOpen = useCallback((url?: string) => {
    if (!url) return;
    const baseUrl = typeof window !== 'undefined' ? window.location?.origin ?? '' : '';
    const safeUrl = getSafeExternalUrl(url, { allowRelative: true, baseUrl });
    if (!safeUrl) return;
    if (typeof window !== 'undefined') window.open(safeUrl, '_blank', 'noopener,noreferrer');
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
  const shortAddress = address && address.length > 200 ? `${address.slice(0, 200)}…` : address;

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
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="popup-content">
          <div
            className="popup-photo"
          >
            {optimizedImageUrl && !imageError ? (
              <ImageCardMedia
                src={optimizedImageUrl}
                alt={address || 'Фото точки'}
                fit="contain"
                blurBackground
                blurRadius={18}
                overlayColor={colors.overlayLight}
                loading="lazy"
                priority="low"
                style={{ position: 'absolute', inset: 0 } as any}
                onLoad={() => {
                  setImageError(false);
                }}
                onError={() => {
                  const src = String(optimizedImageUrl || '');
                  if (src) {
                    const isDev =
                      typeof process !== 'undefined' &&
                      Boolean((process as any).env?.NODE_ENV) &&
                      (process as any).env.NODE_ENV !== 'production';
                    if (isDev && !loggedImageErrorsRef.current.has(src)) {
                      loggedImageErrorsRef.current.add(src);
                      console.warn('[PopupContent] Image failed to load:', { src });
                    }
                  }
                  setImageError(true);
                }}
              />
            ) : (
              <div className="popup-image-placeholder" aria-label="Нет фото для этой точки">
                <span className="popup-placeholder-stub" aria-hidden="true" />
              </div>
            )}

            {cats[0] && (
              <div className="popup-photo-badge" aria-label="Категория локации">
                {cats[0]}
              </div>
            )}
            <div className="popup-bottom-bar" onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}>
              <div className="popup-bottom-title" title={address}>{address}</div>
              <button
                type="button"
                className={"popup-expand-handle" + (expanded ? " popup-expand-handle-active" : "")}
                aria-label={expanded ? "Свернуть информацию" : "Развернуть информацию"}
              >
                <span className="popup-expand-dot" />
              </button>
            </div>

            {expanded && (
              <div
                className="popup-expanded-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="popup-expanded-header">
                  <p className="popup-title" title={address}>{shortAddress}</p>
                  <button
                    type="button"
                    className="popup-expanded-close"
                    aria-label="Свернуть информацию"
                    onClick={() => setExpanded(false)}
                  >
                    <CloseIcon />
                  </button>
                </div>

                {coord && (
                  <div className="popup-coord">
                    <span className="popup-coord-label">Координаты</span>
                    <div className="popup-coord-inline">
                      <span className="popup-coord-text" title={coord}>{coord}</span>
                      <button
                        type="button"
                        className="popup-coord-copy-btn"
                        aria-label="Скопировать координаты"
                        title="Скопировать координаты"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCoord();
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                    {copied && <em className="popup-copied" aria-live="polite">✓ скопировано</em>}
                  </div>
                )}

                <div className="popup-expanded-actions" aria-label="Действия с точкой">
                  <div className="popup-icons-group">
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
                    {(urlTravel || articleUrl) && (
                      <button
                        className="popup-icon-btn popup-icon-btn-with-label"
                        onClick={(e) => { e.stopPropagation(); openPrimary(); }}
                        title="Открыть статью или квест"
                        aria-label="Открыть подробную статью"
                      >
                        <LinkIcon />
                        <span className="popup-icon-label">Открыть</span>
                      </button>
                    )}
                  </div>
                </div>

                {description ? (
                  <div className="popup-description-wrapper">
                    <p className="popup-description" title={description}>{description}</p>
                  </div>
                ) : null}

                {cats.length > 0 ? (
                  <div className="popup-category-container">
                    {cats.slice(1).map((cat, i) => (
                      <span key={`${cat}-${i}`} className="popup-category">{cat}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
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

/** Исправленные стили (web) */
const popupStyles = `
.popup-container {
  position: relative;
  margin: 0;
  padding: 0;
}

.popup-card {
  position: relative;
  width: min(320px, calc(100vw - 14px));
  min-width: 210px;
  max-height: calc(100vh - 220px);
  border-radius: 18px;
  overflow: hidden;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
  cursor: pointer;
  background: var(--color-surface);
  box-shadow: var(--shadow-modal);
  outline: none;
  display: flex;
  flex-direction: column;
  transform: translateY(0);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.popup-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-heavy);
}

.popup-card:focus {
  box-shadow: 0 0 0 3px var(--color-focusStrong), var(--shadow-modal);
}

.popup-content {
  display: flex;
}

.popup-photo {
  position: relative;
  overflow: hidden;
  width: 100%;
  /* Фиксированная высота, чтобы карточки с фото и без фото были одинаковыми */
  height: clamp(180px, 30vh, 280px);
  background-color: var(--color-backgroundTertiary);
}

.popup-photo-badge {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 2;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--color-overlay);
  color: var(--color-textOnDark);
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
  background: var(--color-backgroundTertiary);
}

.popup-placeholder-stub {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    var(--color-backgroundSecondary),
    var(--color-surface),
    var(--color-backgroundSecondary)
  );
  opacity: 0.9;
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
  gap: 4px;
  background: var(--color-overlay);
  border-radius: 12px;
  padding: 8px 10px;
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-heavy);
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
  background: var(--color-overlayLight);
  transform: scale(1.05);
}

.popup-icon-btn-with-label {
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  min-width: 56px;
}

.popup-icon-label {
  font-size: 9px;
  font-weight: 600;
  color: var(--color-textOnDark);
  text-shadow: 0 1px 2px var(--color-overlay);
  white-space: nowrap;
  line-height: 1;
  margin-top: 2px;
}

.popup-info {
  padding: 20px 22px;
  background: var(--color-surface);
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
  font-size: 11px;
  line-height: 1.25;
  color: var(--color-text);
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.popup-click-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-successLight);
  color: var(--color-successDark);
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
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.popup-coord-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-textSubtle);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.popup-coord-text {
  border: 1px dashed var(--color-borderStrong);
  background: var(--color-backgroundSecondary);
  color: var(--color-text);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: default;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  appearance: none;
  -webkit-appearance: none;
}

.popup-coord-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.popup-coord-copy-btn {
  border: none;
  background: var(--color-overlayLight);
  padding: 4px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease;
}

.popup-coord-copy-btn:hover {
  background: var(--color-overlay);
  transform: translateY(-1px) scale(1.03);
}

.popup-coord-text:hover {
  background: var(--color-surface);
  border-color: var(--color-borderStrong);
  box-shadow: var(--shadow-light);
}

.popup-coord-text:focus-visible {
  outline: 2px solid var(--color-focusStrong);
  outline-offset: 2px;
}

.popup-copied {
  color: var(--color-success);
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
}

.popup-description-wrapper {
  position: relative;
}

.popup-description {
  color: var(--color-textMuted);
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
  color: var(--color-info);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}

.popup-read-more:hover {
  color: var(--color-infoDark);
}

.popup-photo-img {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  transition: transform 0.3s ease;
}

.popup-photo:hover .popup-photo-img {
  transform: scale(1.05);
}

.popup-bottom-bar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--color-overlay);
  color: var(--color-textOnDark) !important;
  backdrop-filter: blur(10px);
}

.popup-bottom-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-textOnDark) !important;
  text-shadow: 0 1px 2px var(--color-overlay);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

html[data-theme="light"] .popup-bottom-bar {
  background: rgba(31, 31, 31, 0.58);
}

.popup-expand-handle {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s ease, background 0.2s ease;
}

.popup-expand-handle-active {
  transform: rotate(180deg);
}

.popup-expand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text);
}

.popup-expanded-card {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 16px;
  top: 40%;
  z-index: 4;
  border-radius: 18px;
  background: var(--color-surface);
  box-shadow: var(--shadow-modal);
  padding: 8px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(12px);
  overflow: hidden;
  max-height: calc(100% - 32px);
  overflow-y: auto;
}

.popup-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.popup-expanded-close {
  border: none;
  background: var(--color-overlay);
  padding: 4px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease;
}

.popup-expanded-close:hover {
  background: var(--color-overlay);
  transform: scale(1.05);
}

.popup-primary-btn {
  margin-top: 8px;
  align-self: flex-start;
  border-radius: 999px;
  border: none;
  background: var(--color-info);
  color: var(--color-textOnDark);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.popup-primary-btn:hover {
  background: var(--color-infoDark);
  box-shadow: var(--shadow-medium);
}

.popup-expanded-actions {
  margin-top: 4px;
}

.popup-category-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.popup-category {
  background: var(--color-accentLight);
  color: var(--color-accentDark);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.popup-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: var(--color-overlay);
  color: var(--color-textOnDark);
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

html[data-theme="light"] .popup-close-btn {
  background: rgba(31, 31, 31, 0.58);
}

.popup-close-btn:hover {
  background: var(--color-overlay);
  transform: scale(1.08);
}

.popup-close-btn .popup-svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.popup-svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
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
  background: var(--color-surface) !important;
  box-shadow: var(--shadow-light) !important;
}

@media (max-width: 700px) {
  .popup-card {
    width: calc(100vw - 24px);
    max-width: 420px;
    min-width: 0;
    max-height: calc(100vh - 160px);
  }

  .popup-photo {
    height: clamp(160px, 26vh, 220px);
  }

  .popup-expanded-card {
    top: 42%;
    border-radius: 16px;
  }

  .popup-info {
    padding: 16px 14px 16px;
  }

  .popup-close-btn {
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 420px), (max-height: 650px) {
  .popup-card {
    width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    border-radius: 16px;
  }

  .popup-photo {
    height: clamp(140px, 24vh, 190px);
  }

  .popup-bottom-bar {
    left: 10px;
    right: 10px;
    bottom: 8px;
    padding: 7px 10px;
  }

  .popup-bottom-title {
    font-size: 11px;
  }

  .popup-expand-handle {
    width: 22px;
    height: 22px;
  }

  .popup-expanded-card {
    left: 10px;
    right: 10px;
    bottom: 12px;
    top: 38%;
  }

  .popup-close-btn {
    width: 26px;
    height: 26px;
  }
}
.popup-category-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.popup-category {
  background: var(--color-accentLight);
  color: var(--color-accentDark);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
`;

// Безопасное добавление стилей (только в браузере)
if (typeof document !== 'undefined') {
  const doc = document as Document;
  const hasDomApi =
    typeof doc.getElementById === 'function' &&
    typeof doc.createElement === 'function' &&
    !!doc.head;

  if (hasDomApi) {
    const id = 'popup-content-web-style';
    let styleTag = doc.getElementById(id) as HTMLStyleElement | null;

    if (!styleTag) {
      styleTag = doc.createElement('style');
      styleTag.id = id;
      doc.head.appendChild(styleTag);
    }

    if (styleTag && styleTag.innerHTML !== popupStyles) {
      styleTag.innerHTML = popupStyles;
    }
  }
}

export default PopupContentWeb;
