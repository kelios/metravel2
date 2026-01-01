/**
 * Theme Toggle Component
 * Allows users to switch between light and dark mode
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, useThemedColors } from '@/hooks/useTheme';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

/**
 * Переключатель темы (Light/Dark/Auto)
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'medium',
  showLabel = false,
}) => {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
          pressed && { ...styles.mobileTogglePressed, backgroundColor: colors.surfaceLight },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Переключить тему (текущая: ${isDark ? 'тёмная' : 'светлая'})`}
        accessibilityHint="Дважды нажмите, чтобы переключить между светлым и тёмным режимом"
      >
        <MaterialIcons
          name={isDark ? 'light-mode' : 'dark-mode'}
          size={iconSize}
          color={colors.text}
        />
        {showLabel && (
          <Text style={[styles.label, { color: colors.text }]}>{isDark ? 'Light' : 'Dark'}</Text>
        )}
      </Pressable>
    );
  }

  // Web version with dropdown
  const webStyles = getWebStyles(colors);

  return (
    <div style={webStyles.container}>
      <button
        onClick={handlePress}
        className="theme-toggle-button"
        title={`Переключить на ${isDark ? 'светлый' : 'тёмный'} режим`}
        aria-label={`Переключить тему (текущая: ${isDark ? 'тёмная' : 'светлая'})`}
        style={webStyles.toggleButton}
      >
        <MaterialIcons
          name={isDark ? 'light-mode' : 'dark-mode'}
          size={iconSize}
          color={colors.text}
        />
        {showLabel && <span style={webStyles.label}>
          {theme === 'auto' ? 'Auto' : isDark ? 'Dark' : 'Light'}
        </span>}
      </button>

      {/* Dropdown menu with theme options */}
      <div
        className="theme-menu"
        role="menu"
        aria-label="Theme options"
        style={webStyles.menu}
      >
        <button
          role="menuitem"
          aria-current={theme === 'light' ? 'true' : 'false'}
          onClick={() => setTheme('light')}
          style={webStyles.menuItem}
        >
          <MaterialIcons name="light-mode" size={16} color={colors.text} />
          <span>Light</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'dark' ? 'true' : 'false'}
          onClick={() => setTheme('dark')}
          style={webStyles.menuItem}
        >
          <MaterialIcons name="dark-mode" size={16} color={colors.text} />
          <span>Dark</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'auto' ? 'true' : 'false'}
          onClick={handlePressAuto}
          style={webStyles.menuItem}
        >
          <MaterialIcons name="brightness-auto" size={16} color={colors.text} />
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
          color: ${colors.text};
          transition: background-color 0.2s ease;
        }

        .theme-toggle-button:hover {
          background-color: ${colors.surfaceMuted};
        }

        .theme-toggle-button:focus-visible {
          outline: 3px solid ${colors.primary};
          outline-offset: 2px;
        }

        .theme-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 8px;
          background-color: ${colors.surface};
          border: 1px solid ${colors.border};
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
          color: ${colors.text};
          font-size: 14px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s;
        }

        .theme-menu button:hover {
          background-color: ${colors.surfaceMuted};
        }

        .theme-menu button[aria-current="true"] {
          background-color: ${colors.primarySoft};
          color: ${colors.primary};
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

const getStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
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
    backgroundColor: colors.surfaceMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
});

const getWebStyles = (
  colors: ReturnType<typeof useThemedColors>
): Record<string, React.CSSProperties> => ({
  container: {
    position: 'relative',
  },
  toggleButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    zIndex: 1000,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    opacity: 0,
    visibility: 'hidden',
    transform: 'translateY(-8px)',
    transition: 'opacity 0.2s, visibility 0.2s, transform 0.2s',
  },
  menuItem: {
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: colors.text,
    fontSize: 14,
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
});

export default ThemeToggle;
