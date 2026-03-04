/**
 * 🎯 SkipToContentLink Component
 *
 * Помогает пользователям с клавиатурой и screen readers быстро перейти к основному контенту
 * Видна только при фокусе (с помощью Tab)
 */

import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface SkipToContentLinkProps {
  targetId?: string;
  label?: string;
}

export const SkipToContentLink: React.FC<SkipToContentLinkProps> = ({
  targetId = 'main-content',
  label = 'Skip to main content',
}) => {
  const linkStyle = useMemo(
    () => ({
      position: 'absolute',
      top: 0,
      left: '-9999px',
      background: DESIGN_TOKENS.colors.text,
      color: DESIGN_TOKENS.colors.textOnDark,
      padding: `${DESIGN_TOKENS.spacing.xs}px ${DESIGN_TOKENS.spacing.sm}px`,
      textDecoration: 'none',
      zIndex: DESIGN_TOKENS.zIndex.fixed,
      borderRadius: `0 0 ${DESIGN_TOKENS.radii.sm}px ${DESIGN_TOKENS.radii.sm}px`,
      fontSize: `${DESIGN_TOKENS.typography.sizes.sm}px`,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold,
      transition: `left ${DESIGN_TOKENS.animations.duration.normal}ms ${DESIGN_TOKENS.animations.easing.default}`,
    }),
    []
  );

  if (Platform.OS !== 'web') {
    return null; // Не требуется для React Native
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="skip-to-content"
      style={linkStyle as React.CSSProperties}
      onFocus={(e) => {
        (e.target as HTMLAnchorElement).style.left = '0';
      }}
      onBlur={(e) => {
        (e.target as HTMLAnchorElement).style.left = '-9999px';
      }}
    >
      {label}
    </a>
  );
};

export default SkipToContentLink;
