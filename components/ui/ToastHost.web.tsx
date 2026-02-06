import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { WEB_TOAST_EVENT_NAME } from '@/utils/toast.web';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
};

const ICON_MAP: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const ACCENT_COLORS: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
  warning: '#f59e0b',
};

const SLIDE_DURATION_MS = 250;

export default function ToastHost() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as ToastPayload;
      clearTimers();

      setPayload(detail ?? null);
      // Trigger slide-in on next frame
      requestAnimationFrame(() => setVisible(true));

      const visibilityTime =
        typeof detail?.visibilityTime === 'number' && detail.visibilityTime > 0
          ? detail.visibilityTime
          : 3000;

      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        slideTimerRef.current = setTimeout(() => setPayload(null), SLIDE_DURATION_MS);
      }, visibilityTime);
    };

    window.addEventListener(WEB_TOAST_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(WEB_TOAST_EVENT_NAME, handler as EventListener);
      clearTimers();
    };
  }, [clearTimers]);

  const toastType = (payload?.type ?? 'info') as ToastType;
  const accent = ACCENT_COLORS[toastType] ?? ACCENT_COLORS.info;
  const icon = ICON_MAP[toastType] ?? ICON_MAP.info;
  const position = payload?.position ?? 'bottom';
  const isBottom = position !== 'top';

  const containerStyle = useMemo((): React.CSSProperties => ({
    position: 'fixed',
    left: '50%',
    zIndex: 99999,
    maxWidth: 420,
    width: 'calc(100% - 32px)',
    pointerEvents: 'auto',
    transition: `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${SLIDE_DURATION_MS}ms ease`,
    transform: visible
      ? 'translateX(-50%) translateY(0)'
      : `translateX(-50%) translateY(${isBottom ? '20px' : '-20px'})`,
    opacity: visible ? 1 : 0,
    ...(isBottom ? { bottom: 72 } : { top: 12 }),
  }), [visible, isBottom]);

  const cardStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 12,
    background: 'rgba(17, 17, 17, 0.94)',
    color: '#fff',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    fontSize: 14,
    lineHeight: '1.4',
    borderLeft: `3px solid ${accent}`,
    backdropFilter: 'blur(8px)',
  }), [accent]);

  const iconStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: accent,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    lineHeight: '22px',
    textAlign: 'center',
    marginTop: 1,
  }), [accent]);

  if (!payload?.text1 && !payload?.text2) return null;

  return (
    <div style={containerStyle} aria-live="polite" role="status">
      <div style={cardStyle}>
        <div style={iconStyle} aria-hidden="true">{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {payload.text1 ? (
            <div style={{ fontWeight: 600, fontSize: 14 }}>{payload.text1}</div>
          ) : null}
          {payload.text2 ? (
            <div style={{ opacity: 0.78, fontSize: 13, marginTop: 2 }}>{payload.text2}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
