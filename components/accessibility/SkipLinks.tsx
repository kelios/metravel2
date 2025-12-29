/**
 * Skip Links Component
 * Accessibility feature - allows keyboard users to skip to main content
 */

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface SkipLinksProps {
  onSkip?: (id: string) => void;
}

/**
 * Компонент для быстрого перехода к основному контенту (веб-доступность)
 * Видим только при Tab фокусе
 */
export const SkipLinks: React.FC<SkipLinksProps> = ({ onSkip }) => {
  if (Platform.OS !== 'web') {
    return null; // Skip links only on web
  }

  const handleSkipToMain = () => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSkip?.('main-content');
    }
  };

  const handleSkipToNavigation = () => {
    const navigation = document.getElementById('main-navigation');
    if (navigation) {
      navigation.focus();
      onSkip?.('navigation');
    }
  };

  return (
    <>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="skip-link skip-link-main"
        onClick={(e) => {
          e.preventDefault();
          handleSkipToMain();
        }}
        style={styles.skipLink as React.CSSProperties}
        role="navigation"
        aria-label="Skip to main content"
      >
        Перейти к основному контенту
      </a>

      {/* Skip to navigation link */}
      <a
        href="#main-navigation"
        className="skip-link skip-link-nav"
        onClick={(e) => {
          e.preventDefault();
          handleSkipToNavigation();
        }}
        style={styles.skipLink as React.CSSProperties}
        role="navigation"
        aria-label="Skip to navigation"
      >
        Перейти к навигации
      </a>

      {/* CSS for skip links visibility on focus */}
      <style>{`
        .skip-link {
          position: absolute;
          top: -9999px;
          left: -9999px;
          z-index: 99999;
          display: block;
          padding: 12px 20px;
          background-color: ${DESIGN_TOKENS.colors.primary};
          color: white;
          text-decoration: none;
          border-radius: 4px;
          font-weight: 600;
          font-size: 14px;
        }

        .skip-link:focus {
          top: 10px;
          left: 10px;
          outline: 3px solid ${DESIGN_TOKENS.colors.text};
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: no-preference) {
          .skip-link {
            transition: top 0.2s, left 0.2s;
          }
        }
      `}</style>
    </>
  );
};

const styles = StyleSheet.create({
  skipLink: {
    position: 'absolute' as any,
    top: -9999,
    left: -9999,
    zIndex: 99999,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
  },
});

export default SkipLinks;

