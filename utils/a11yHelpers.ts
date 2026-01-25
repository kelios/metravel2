/**
 * Accessibility helpers for improved PageSpeed accessibility scores
 */

export const generateAriaLabel = (context: {
  type: 'button' | 'link' | 'image' | 'input' | 'heading';
  action?: string;
  target?: string;
  description?: string;
}): string => {
  const { type, action, target, description } = context;
  
  switch (type) {
    case 'button':
      return action && target 
        ? `${action} ${target}` 
        : action || description || 'Button';
    case 'link':
      return target 
        ? `Link to ${target}` 
        : description || 'Link';
    case 'image':
      return description || 'Image';
    case 'input':
      return description || 'Input field';
    case 'heading':
      return description || 'Heading';
    default:
      return description || '';
  }
};

export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;

    const [rs, gs, bs] = [r, g, b].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

export const meetsWCAGAA = (foreground: string, background: string, isLargeText = false): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
};

export const meetsWCAGAAA = (foreground: string, background: string, isLargeText = false): boolean => {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
};

export const generateSkipLink = (targetId: string, label: string) => ({
  href: `#${targetId}`,
  label,
  className: 'visually-hidden visually-hidden-focusable',
});

export const announceToScreenReader = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', politeness);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'visually-hidden';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

export const focusTrap = {
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(container.querySelectorAll(selector));
  },

  trap: (container: HTMLElement) => {
    const focusableElements = focusTrap.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeydown);

    return () => {
      container.removeEventListener('keydown', handleKeydown);
    };
  },
};

export const ensureFocusVisible = () => {
  if (typeof document === 'undefined') return;

  let hadKeyboardEvent = false;

  const handleKeyDown = () => {
    hadKeyboardEvent = true;
  };

  const handlePointerDown = () => {
    hadKeyboardEvent = false;
  };

  const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (hadKeyboardEvent && target) {
      target.classList.add('focus-visible');
    }
  };

  const handleBlur = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target) {
      target.classList.remove('focus-visible');
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('mousedown', handlePointerDown, true);
  document.addEventListener('focus', handleFocus, true);
  document.addEventListener('blur', handleBlur, true);
};

export const headingStructure = {
  validate: (container: HTMLElement): boolean => {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let currentLevel = 0;

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1], 10);
      
      if (level - currentLevel > 1) {
        console.warn(`Heading structure: Skipped from h${currentLevel} to h${level}`);
        return false;
      }
      
      currentLevel = level;
    }

    return true;
  },

  hasH1: (container: HTMLElement = document.body): boolean => {
    return container.querySelectorAll('h1').length === 1;
  },
};
