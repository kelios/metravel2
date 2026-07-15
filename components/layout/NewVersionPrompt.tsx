import React, { useMemo } from 'react'

import { useNewVersionAvailable } from '@/hooks/useNewVersionAvailable'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'


/**
 * Non-blocking "new version available" banner (web only).
 *
 * Rendered inside the deferred web chrome so the version check never touches the
 * critical load path. Shows only after a newer deployed bundle is detected; the
 * user can reload or dismiss. There is no auto-reload.
 */
export default function NewVersionPrompt() {
  const { available, reload, dismiss } = useNewVersionAvailable()

  const containerStyle = useMemo(
    (): React.CSSProperties => ({
      position: 'fixed',
      left: '50%',
      bottom: 72,
      transform: 'translateX(-50%)',
      zIndex: 99998,
      maxWidth: 420,
      width: 'calc(100% - 32px)',
      pointerEvents: 'auto',
    }),
    []
  )

  const cardStyle = useMemo(
    (): React.CSSProperties => ({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 12,
      backgroundColor: 'rgba(17, 17, 17, 0.94)',
      color: DESIGN_TOKENS.colors.textOnDark,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      fontSize: 14,
      lineHeight: '1.4',
      borderLeft: `3px solid ${DESIGN_TOKENS.colors.primary}`,
    }),
    []
  )

  const reloadButtonStyle = useMemo(
    (): React.CSSProperties => ({
      flexShrink: 0,
      padding: '8px 14px',
      borderRadius: 8,
      backgroundColor: DESIGN_TOKENS.colors.primary,
      color: DESIGN_TOKENS.colors.textOnDark,
      fontSize: 14,
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
    }),
    []
  )

  const dismissButtonStyle = useMemo(
    (): React.CSSProperties => ({
      flexShrink: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      color: DESIGN_TOKENS.colors.textOnDark,
      fontSize: 16,
      lineHeight: '28px',
      border: 'none',
      cursor: 'pointer',
      opacity: 0.7,
    }),
    []
  )

  if (!available) return null

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <div style={cardStyle}>
        <span style={{ flex: 1, minWidth: 0 }}>{i18nT('navigation:components.layout.NewVersionPrompt.dostupna_novaya_versiya_cb863f5c')}</span>
        <button type="button" style={reloadButtonStyle} onClick={reload}>
          {i18nT('navigation:components.layout.NewVersionPrompt.obnovit_5039ac04')}</button>
        <button
          type="button"
          style={dismissButtonStyle}
          onClick={dismiss}
          aria-label={i18nT('navigation:components.layout.NewVersionPrompt.zakryt_077bdfcd')}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
