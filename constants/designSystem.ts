export const DESIGN_TOKENS = {
  colors: {
    background: "#f6f4ef",
    surface: "#ffffff",
    surfaceMuted: "rgba(255,255,255,0.82)",
    card: "#ffffff",
    cardMuted: "#f7f6f2",
    dockBackground: "rgba(255,255,255,0.92)",
    dockBorder: "rgba(74,140,140,0.15)",
    text: "#1f2937",
    textMuted: "#525866",
    textSubtle: "#8c8f98",
    primary: "#4a8c8c",
    primarySoft: "rgba(74,140,140,0.12)",
    accent: "#6b7280", // ✅ УЛУЧШЕНИЕ: Нейтральный серый вместо яркого оранжевого
    accentSoft: "rgba(107, 114, 128, 0.12)",
    success: "#22c55e",
    successSoft: "rgba(34,197,94,0.15)",
    warning: "#fbbf24",
    warningSoft: "rgba(251,191,36,0.15)",
    danger: "#ef4444",
    dangerSoft: "rgba(239,68,68,0.12)",
    info: "#3b82f6",
    infoSoft: "rgba(59,130,246,0.12)",
    border: "rgba(15,23,42,0.08)",
    borderStrong: "rgba(15,23,42,0.16)",
    focus: "rgba(74,140,140,0.35)",
    mutedBackground: "#f4f3ef",
    disabled: "#d4d4d4",
  },
  radii: {
    xl: 28,
    lg: 20,
    md: 16,
    sm: 12,
    pill: 999,
  },
  shadows: {
    soft: "0 2px 6px rgba(0, 0, 0, 0.03)", // ✅ УЛУЧШЕНИЕ: Упрощенные тени
    medium: "0 4px 8px rgba(0, 0, 0, 0.04)",
  },
  spacing: {
    xxs: 2,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  typography: {
    fontFamily: "'Inter', 'System'",
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
  },
};


