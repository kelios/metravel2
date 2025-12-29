/**
 * Accessible Focus Management Component
 * Handles focus styles and visible indicators
 */

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface FocusableProps {
  children: React.ReactNode;
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  style?: React.CSSProperties;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Wrapper компонент для видимого focus indicator
 */
export const FocusableButton: React.FC<FocusableProps> = ({
  children,
  onFocus,
  onBlur,
  style,
  accessibilityLabel,
  testID,
}) => {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        ...style,
        ...styles.focusableContainer,
      } as React.CSSProperties}
      onFocus={onFocus}
      onBlur={onBlur}
      data-testid={testID}
    >
      {children}

      <style>{`
        [data-testid="${testID}"]:focus-visible {
          outline: 3px solid ${DESIGN_TOKENS.colors.primary};
          outline-offset: 2px;
          border-radius: 4px;
        }

        [data-testid="${testID}"]:focus-visible::-moz-focus-inner {
          border: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          [data-testid="${testID}"] {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * CSS для глобальных focus стилей
 */
export const FocusStyles = () => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <style>{`
      /* Видимый focus для всех интерактивных элементов */
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 3px solid ${DESIGN_TOKENS.colors.primary};
        outline-offset: 2px;
      }

      /* Убрать default outline и заменить на custom */
      button:focus,
      a:focus,
      input:focus,
      select:focus,
      textarea:focus {
        outline: none;
      }

      /* Focus styles for buttons */
      button:focus-visible {
        box-shadow: 0 0 0 3px ${DESIGN_TOKENS.colors.primary};
        border-radius: 4px;
      }

      /* Focus styles for links */
      a:focus-visible {
        border-radius: 2px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: more) {
        button:focus-visible,
        a:focus-visible,
        input:focus-visible {
          outline-width: 4px;
          outline-offset: 3px;
        }
      }

      /* Respects prefers-reduced-motion */
      @media (prefers-reduced-motion: reduce) {
        button,
        a,
        input {
          transition: none;
        }
      }

      /* Remove focus from mouse users (for cleaner UI) */
      button:focus:not(:focus-visible),
      a:focus:not(:focus-visible),
      input:focus:not(:focus-visible) {
        outline: none;
      }
    `}</style>
  );
};

/**
 * Hook для управления focus state
 */
export function useFocusManagement() {
  const [isFocused, setIsFocused] = React.useState(false);
  const [focusedElement, setFocusedElement] = React.useState<string | null>(null);

  const handleFocus = React.useCallback((id: string) => {
    setIsFocused(true);
    setFocusedElement(id);
  }, []);

  const handleBlur = React.useCallback(() => {
    setIsFocused(false);
    setFocusedElement(null);
  }, []);

  return {
    isFocused,
    focusedElement,
    handleFocus,
    handleBlur,
  };
}

/**
 * Hook для перемещения focus при открытии modal/dialog
 */
export function useFocusTrap(isOpen: boolean, returnFocusRef?: React.RefObject<HTMLElement>) {
  const previousActiveElement = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    // Сохранить текущий focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Вернуть focus при закрытии
    return () => {
      if (returnFocusRef?.current) {
        returnFocusRef.current.focus();
      } else if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, returnFocusRef]);
}

const styles = {
  focusableContainer: {
    position: 'relative',
  } as React.CSSProperties,
};

export default FocusStyles;

