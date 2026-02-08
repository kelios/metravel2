/**
 * Theme Toggle Component
 * Allows users to switch between light and dark mode
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme, useThemedColors } from '@/hooks/useTheme';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  compact?: boolean;
}

/**
 * Переключатель темы (Light/Dark/Auto)
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'medium',
  showLabel = false,
  compact = false,
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
        <Feather
          name={isDark ? 'sun' : 'moon'}
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
  const webStyles = getWebStyles(colors, compact);

  // Compact mode: render all buttons inline
  if (compact) {
    return (
      <div style={webStyles.container}>
        <button
          onClick={() => setTheme('light')}
          className="theme-button-compact"
          aria-current={theme === 'light' ? 'true' : 'false'}
          title="Светлая тема"
          style={{
            ...webStyles.compactButton,
            ...(theme === 'light' ? webStyles.compactButtonActive : {}),
          }}
        >
          <Feather name="sun" size={14} color={theme === 'light' ? colors.primary : colors.text} />
          <span style={webStyles.compactLabel}>Светлая</span>
        </button>

        <button
          onClick={() => setTheme('dark')}
          className="theme-button-compact"
          aria-current={theme === 'dark' ? 'true' : 'false'}
          title="Тёмная тема"
          style={{
            ...webStyles.compactButton,
            ...(theme === 'dark' ? webStyles.compactButtonActive : {}),
          }}
        >
          <Feather name="moon" size={14} color={theme === 'dark' ? colors.primary : colors.text} />
          <span style={webStyles.compactLabel}>Тёмная</span>
        </button>

        <button
          onClick={handlePressAuto}
          className="theme-button-compact"
          aria-current={theme === 'auto' ? 'true' : 'false'}
          title="Автоматическая тема"
          style={{
            ...webStyles.compactButton,
            ...(theme === 'auto' ? webStyles.compactButtonActive : {}),
          }}
        >
          <Feather name="monitor" size={14} color={theme === 'auto' ? colors.primary : colors.text} />
          <span style={webStyles.compactLabel}>Авто</span>
        </button>

        <style>{`
          .theme-button-compact:hover {
            background-color: ${colors.surfaceMuted} !important;
          }
          .theme-button-compact:focus-visible {
            outline: 2px solid ${colors.primary};
            outline-offset: 1px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={webStyles.container}>
      <button
        onClick={handlePress}
        className="theme-toggle-button"
        title={`Переключить на ${isDark ? 'светлый' : 'тёмный'} режим`}
        aria-label={`Переключить тему (текущая: ${isDark ? 'тёмная' : 'светлая'})`}
        style={webStyles.toggleButton}
      >
        <Feather
          name={isDark ? 'sun' : 'moon'}
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
          <Feather name="sun" size={16} color={colors.text} />
          <span>Light</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'dark' ? 'true' : 'false'}
          onClick={() => setTheme('dark')}
          style={webStyles.menuItem}
        >
          <Feather name="moon" size={16} color={colors.text} />
          <span>Dark</span>
        </button>

        <button
          role="menuitem"
          aria-current={theme === 'auto' ? 'true' : 'false'}
          onClick={handlePressAuto}
          style={webStyles.menuItem}
        >
          <Feather name="monitor" size={16} color={colors.text} />
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
          padding: ${compact ? '4px' : '8px'};
          border-radius: ${compact ? '4px' : '6px'};
          display: flex;
          align-items: center;
          gap: ${compact ? '4px' : '8px'};
          color: ${colors.text};
          transition: background-color 0.2s ease;
          ${compact ? 'flex: 1; min-width: 0;' : ''}
        }

        .theme-toggle-button:hover {
          background-color: ${colors.surfaceMuted};
        }

        .theme-toggle-button:focus-visible {
          outline: ${compact ? '2px' : '3px'} solid ${colors.primary};
          outline-offset: ${compact ? '1px' : '2px'};
        }

        .theme-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: ${compact ? '4px' : '8px'};
          background-color: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: ${compact ? '6px' : '8px'};
          box-shadow: 0 ${compact ? '2px 4px' : '4px 6px'} rgba(0, 0, 0, 0.1);
          z-index: 1000;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
          min-width: ${compact ? '100px' : '120px'};
        }

        .theme-toggle-button:focus-within ~ .theme-menu,
        .theme-menu:hover {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .theme-menu button {
          width: 100%;
          padding: ${compact ? '6px 10px' : '10px 16px'};
          background: transparent;
          border: none;
          cursor: pointer;
          color: ${colors.text};
          font-size: ${compact ? '11px' : '14px'};
          text-align: left;
          display: flex;
          align-items: center;
          gap: ${compact ? '4px' : '8px'};
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
          border-radius: ${compact ? '6px 6px 0 0' : '8px 8px 0 0'};
        }

        .theme-menu button:last-child {
          border-radius: ${compact ? '0 0 6px 6px' : '0 0 8px 8px'};
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
  colors: ReturnType<typeof useThemedColors>,
  compact: boolean = false
): Record<string, React.CSSProperties> => ({
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: compact ? 'row' : 'column',
    flexWrap: compact ? 'wrap' : 'nowrap',
    gap: compact ? 4 : 8,
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
  },
  toggleButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: compact ? 4 : 8,
    borderRadius: compact ? 4 : 6,
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 4 : 8,
    color: colors.text,
    flex: compact ? 1 : 'none',
    minWidth: 0,
  },
  label: {
    fontSize: compact ? 11 : 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: compact ? 4 : 8,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: compact ? 6 : 8,
    zIndex: 1000,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    opacity: 0,
    visibility: 'hidden',
    transform: 'translateY(-8px)',
    transition: 'opacity 0.2s, visibility 0.2s, transform 0.2s',
    minWidth: compact ? 100 : 120,
  },
  menuItem: {
    width: '100%',
    padding: compact ? '6px 10px' : '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: colors.text,
    fontSize: compact ? 11 : 14,
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 4 : 8,
  },
  compactButton: {
    flex: 1,
    minWidth: 0,
    padding: '5px 6px',
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    color: colors.text,
    fontSize: 10,
    boxSizing: 'border-box',
    maxWidth: '100%',
    transition: 'all 0.2s ease',
  },
  compactButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
  },
  compactLabel: {
    fontSize: 10,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

export default ThemeToggle;
