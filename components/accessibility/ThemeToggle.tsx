/**
 * Theme Toggle Component
 * Allows users to switch between light and dark mode
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  placement?: 'header' | 'menu' | 'settings';
}

/**
 * Переключатель темы (Light/Dark/Auto)
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'medium',
  showLabel = false,
  placement = 'header',
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  const sizeMap = {
    small: 20,
    medium: 24,
    large: 32,
  };

  const iconSize = sizeMap[size];

  const handlePress = () => {
    toggleTheme();
  };

  const handlePressAuto = () => {
    setTheme('auto');
  };

  if (Platform.OS !== 'web') {
    // Simplified version for mobile
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.mobileToggle,
          pressed && styles.mobileTogglePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Переключить тему (текущая: ${isDark ? 'тёмная' : 'светлая'})`}
        accessibilityHint="Дважды нажмите, чтобы переключить между светлым и тёмным режимом"
      >
        <MaterialIcons
          name={isDark ? 'light-mode' : 'dark-mode'}
          size={iconSize}
          color={DESIGN_TOKENS.colors.text}
        />
        {showLabel && (
          <Text style={styles.label}>{isDark ? 'Light' : 'Dark'}</Text>
        )}
      </Pressable>
    );
  }

  // Web version with dropdown
  return (
    <div style={styles.webContainer as React.CSSProperties}>
      <button
        onClick={handlePress}
        className="theme-toggle-button"
        title={`Переключить на ${isDark ? 'светлый' : 'тёмный'} режим`}
        aria-label={`Переключить тему (текущая: ${isDark ? 'тёмная' : 'светлая'})`}
        style={styles.webToggleButton as React.CSSProperties}
      >
        <MaterialIcons
          name={isDark ? 'light-mode' : 'dark-mode'}
          size={iconSize}
          color={DESIGN_TOKENS.colors.text}
        />
        {showLabel && <span style={styles.webLabel as React.CSSProperties}>
          {theme === 'auto' ? 'Auto' : isDark ? 'Dark' : 'Light'}
        </span>}
      </button>

      {/* Dropdown menu with theme options */}
      <div
        className="theme-menu"
        role="menu"
        aria-label="Theme options"
        style={styles.webMenu as React.CSSProperties}
      >
        <button
          role="menuitem"
          aria-current={theme === 'light' ? 'true' : 'false'}
          onClick={() => setTheme('light')}
          style={styles.webMenuItem as React.CSSProperties}
        >
          <MaterialIcons name="light-mode" size={16} color={DESIGN_TOKENS.colors.text} />
          <span>Light</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'dark' ? 'true' : 'false'}
          onClick={() => setTheme('dark')}
          style={styles.webMenuItem as React.CSSProperties}
        >
          <MaterialIcons name="dark-mode" size={16} color={DESIGN_TOKENS.colors.text} />
          <span>Dark</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'auto' ? 'true' : 'false'}
          onClick={handlePressAuto}
          style={styles.webMenuItem as React.CSSProperties}
        >
          <MaterialIcons name="brightness-auto" size={16} color={DESIGN_TOKENS.colors.text} />
          <span>Auto</span>
        </button>
      </div>

      {/* CSS for dropdown visibility and animation */}
      <style>{`
        .theme-toggle-button {
          position: relative;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${DESIGN_TOKENS.colors.text};
          transition: background-color 0.2s ease;
        }

        .theme-toggle-button:hover {
          background-color: ${DESIGN_TOKENS.colors.surfaceLight};
        }

        .theme-toggle-button:focus-visible {
          outline: 3px solid ${DESIGN_TOKENS.colors.primary};
          outline-offset: 2px;
        }

        .theme-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background-color: ${DESIGN_TOKENS.colors.surface};
          border: 1px solid ${DESIGN_TOKENS.colors.border};
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
        }

        .theme-toggle-button:focus-within ~ .theme-menu,
        .theme-menu:hover {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .theme-menu button {
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: ${DESIGN_TOKENS.colors.text};
          font-size: 14px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s;
        }

        .theme-menu button:hover {
          background-color: ${DESIGN_TOKENS.colors.surfaceLight};
        }

        .theme-menu button[aria-current="true"] {
          background-color: ${DESIGN_TOKENS.colors.primarySoft};
          color: ${DESIGN_TOKENS.colors.primary};
          font-weight: 600;
        }

        .theme-menu button:first-child {
          border-radius: 8px 8px 0 0;
        }

        .theme-menu button:last-child {
          border-radius: 0 0 8px 8px;
        }

        @media (prefers-reduced-motion: reduce) {
          .theme-toggle-button,
          .theme-menu {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

const styles = StyleSheet.create({
  mobileToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileTogglePressed: {
    opacity: 0.7,
    backgroundColor: DESIGN_TOKENS.colors.surfaceLight,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.text,
  },
  webContainer: {
    position: 'relative',
  },
  webToggleButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: DESIGN_TOKENS.colors.text,
  },
  webLabel: {
    fontSize: '14px',
    fontWeight: '500',
  },
  webMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
    borderRadius: '8px',
    zIndex: 1000,
  },
  webMenuItem: {
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: DESIGN_TOKENS.colors.text,
    fontSize: '14px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
});

export default ThemeToggle;

