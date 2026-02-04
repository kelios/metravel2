import React, { createContext, useContext } from 'react';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ThemeContextType {
  // Add theme properties as needed
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    sizes: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    weights: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    light: string;
    medium: string;
    heavy: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Default theme values matching DESIGN_TOKENS
  const theme: ThemeContextType = {
    colors: {
      primary: DESIGN_TOKENS.colors.primary,
      secondary: DESIGN_TOKENS.colors.accent,
      background: DESIGN_TOKENS.colors.background,
      surface: DESIGN_TOKENS.colors.surface,
      text: DESIGN_TOKENS.colors.text,
      textMuted: DESIGN_TOKENS.colors.textMuted,
      border: DESIGN_TOKENS.colors.border,
    },
    spacing: {
      xs: DESIGN_TOKENS.spacing.xxs,
      sm: DESIGN_TOKENS.spacing.xs,
      md: DESIGN_TOKENS.spacing.md,
      lg: DESIGN_TOKENS.spacing.lg,
      xl: DESIGN_TOKENS.spacing.xl,
    },
    typography: {
      sizes: {
        xs: DESIGN_TOKENS.typography.sizes.xs,
        sm: DESIGN_TOKENS.typography.sizes.sm,
        md: DESIGN_TOKENS.typography.sizes.md,
        lg: DESIGN_TOKENS.typography.sizes.lg,
        xl: DESIGN_TOKENS.typography.sizes.xl,
      },
      weights: {
        normal: DESIGN_TOKENS.typography.weights.regular,
        medium: DESIGN_TOKENS.typography.weights.medium,
        semibold: DESIGN_TOKENS.typography.weights.semibold,
        bold: DESIGN_TOKENS.typography.weights.bold,
      },
    },
    radii: {
      sm: DESIGN_TOKENS.radii.sm,
      md: DESIGN_TOKENS.radii.md,
      lg: DESIGN_TOKENS.radii.lg,
      xl: DESIGN_TOKENS.radii.xl,
    },
    shadows: {
      light: DESIGN_TOKENS.shadows.light,
      medium: DESIGN_TOKENS.shadows.medium,
      heavy: DESIGN_TOKENS.shadows.heavy,
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
