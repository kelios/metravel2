/**
 * 🎯 SkipToContentLink Component
 *
 * Помогает пользователям с клавиатурой и screen readers быстро перейти к основному контенту
 * Видна только при фокусе (с помощью Tab)
 */

import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface SkipToContentLinkProps {
  targetId?: string;
  label?: string;
}

export const SkipToContentLink: React.FC<SkipToContentLinkProps> = ({
  targetId = 'main-content',
  label = 'Skip to main content',
}) => {
  const colors = useThemedColors();
  const linkStyle = useMemo(
    () => ({
      position: 'absolute',
      top: '-40px',
      left: 0,
      background: colors.primary,
      color: colors.textInverse,
      padding: `${DESIGN_TOKENS.spacing.xs}px ${DESIGN_TOKENS.spacing.sm}px`,
      textDecoration: 'none',
      zIndex: DESIGN_TOKENS.zIndex.fixed,
      borderRadius: `0 0 ${DESIGN_TOKENS.radii.sm}px ${DESIGN_TOKENS.radii.sm}px`,
      fontSize: `${DESIGN_TOKENS.typography.sizes.sm}px`,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold,
      transition: `top ${DESIGN_TOKENS.animations.duration.normal}ms ${DESIGN_TOKENS.animations.easing.default}`,
    }),
    [
      colors.primary,
      colors.textInverse,
    ]
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
        (e.target as HTMLAnchorElement).style.top = '0';
      }}
      onBlur={(e) => {
        (e.target as HTMLAnchorElement).style.top = '-40px';
      }}
    >
      {label}
    </a>
  );
};

export default SkipToContentLink;
