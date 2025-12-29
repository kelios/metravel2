/**
 * 🎯 SkipToContentLink Component
 *
 * Помогает пользователям с клавиатурой и screen readers быстро перейти к основному контенту
 * Видна только при фокусе (с помощью Tab)
 */

import React from 'react';
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
      style={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        background: DESIGN_TOKENS.colors.primary,
        color: DESIGN_TOKENS.colors.textInverse,
        padding: `${DESIGN_TOKENS.spacing.xs}px ${DESIGN_TOKENS.spacing.sm}px`,
        textDecoration: 'none',
        zIndex: DESIGN_TOKENS.zIndex.fixed,
        borderRadius: `0 0 ${DESIGN_TOKENS.radii.sm}px ${DESIGN_TOKENS.radii.sm}px`,
        fontSize: `${DESIGN_TOKENS.typography.sizes.sm}px`,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold,
        transition: `top ${DESIGN_TOKENS.animations.duration.normal}ms ${DESIGN_TOKENS.animations.easing.default}`,
      } as React.CSSProperties}
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

