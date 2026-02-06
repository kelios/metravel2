import React, { useEffect, useMemo, useRef, useState } from 'react';

import { WEB_TOAST_EVENT_NAME } from '@/utils/toast.web';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type ToastPayload = {
  text1?: string;
  text2?: string;
  type?: string;
  visibilityTime?: number;
  position?: 'top' | 'bottom';
};

export default function ToastHost() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as ToastPayload;
      setPayload(detail ?? null);

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      const visibilityTime =
        typeof detail?.visibilityTime === 'number' && detail.visibilityTime > 0
          ? detail.visibilityTime
          : 2000;

      hideTimerRef.current = setTimeout(() => {
        setPayload(null);
      }, visibilityTime);
    };

    window.addEventListener(WEB_TOAST_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(WEB_TOAST_EVENT_NAME, handler as EventListener);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const style = useMemo((): React.CSSProperties => {
    const position = payload?.position ?? 'bottom';
    return {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      maxWidth: 420,
      width: 'calc(100% - 24px)',
      padding: '12px 14px',
      borderRadius: 12,
      background: 'rgba(17, 17, 17, 0.92)',
      color: DESIGN_TOKENS.colors.textOnDark,
      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      fontSize: 14,
      lineHeight: 1.25,
      ...(position === 'top' ? { top: 12 } : { bottom: 12 }),
    };
  }, [payload?.position]);

  if (!payload?.text1 && !payload?.text2) return null;

  return (
    <div style={style} aria-live="polite" role="status">
      {payload.text1 ? <div>{payload.text1}</div> : null}
      {payload.text2 ? <div style={{ opacity: 0.85, marginTop: 4 }}>{payload.text2}</div> : null}
    </div>
  );
}
