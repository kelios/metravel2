import React, { createContext, useContext } from 'react';

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
      primary: '#007bff',
      secondary: '#6c757d',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529',
      textMuted: '#6c757d',
      border: '#dee2e6',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    typography: {
      sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
      },
      weights: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
    radii: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    shadows: {
      light: '0 1px 3px rgba(0,0,0,0.1)',
      medium: '0 4px 6px rgba(0,0,0,0.1)',
      heavy: '0 10px 15px rgba(0,0,0,0.1)',
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
