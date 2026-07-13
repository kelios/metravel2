export const QR_NAV = 80;
export const QR_SITE = 120;
export const MAP_VIEWBOX_WIDTH = 960;
export const MAP_VIEWBOX_HEIGHT = 380;
export const MAP_IMAGE_WIDTH = 1200;
export const MAP_IMAGE_HEIGHT = 520;
export const MAP_IMAGE_ZOOM = 15;
export const MAP_IMAGE_MAX_ZOOM = 17;
export const MAP_IMAGE_FIT_PADDING_FACTOR = 1.08;

export const PRINT_COLORS = {
  brand: '#1a6b8a',
  routeLine: '#2563eb',
  brandDark: '#0f4c62',
  brandMid: '#2480a4',
  brandLight: '#3a9bbf',
  success: '#2d6a4f',
  white: '#ffffff',
  whiteSoft: 'rgba(255,255,255,0.72)',
  whiteGlass: 'rgba(255,255,255,0.88)',
  ink: '#1a2030',
  inkSoft: '#2c3548',
  muted: '#5e6a7a',
  soft: '#f0f4f8',
  line: '#dde4ed',
  brandSoft: '#ebf5fa',
  accent: '#e8a020',
  accentDark: '#c4841a',
  accentSoft: '#fef8ec',
  paperBg: '#f5f7fa',
  panelBorder: '#cdd8e8',
  panelBgStart: '#f4f9fd',
  panelBgEnd: '#fdf8f0',
  brandLine: '#b3d4e6',
  title: '#0f3650',
  titleDark: '#091e2e',
  lineMuted: '#a8b4c4',
  introBorder: '#bcd8e8',
  introText: '#34445a',
  mapBorder: '#c8d9ea',
  mapBg: '#f8fbfe',
  mapGridBg: '#deeef8',
  mapGridBgEnd: '#eaf4fc',
  mapGridStroke: '#c0d4e4',
  chipBorder: '#c8d8ea',
  chipText: '#3a5068',
  tableBorder: '#8aafcc',
  tableText: '#3a4f64',
  tableRow: '#eff3f8',
  tableRowAlt: '#f8fafc',
  tableMuted: '#6b7c90',
  stepBorder: '#d0dcea',
  stepBgEnd: '#fafcff',
  location: '#3a5c78',
  story: '#3a4b5c',
  taskBg: '#fffbf0',
  taskBorder: '#e8d4a0',
  taskInset: '#fef3dc',
  taskText: '#1e3045',
  hint: '#6a7888',
  qrBorder: '#c8d6e4',
  qrImgBorder: '#d0dcea',
  qrText: '#5a6c80',
  answerBorder: '#bfccda',
  answerText: '#6a7888',
  answerLine: '#8aa0b8',
  footerBorder: '#d0d9e4',
  footerText: '#8090a4',
  coverDark: '#071a28',
  coverMid: '#0d2e46',
  coverAccentLine: '#e8a020',
  badgeBg: 'rgba(255,255,255,0.14)',
  badgeBorder: 'rgba(255,255,255,0.28)',
  sectionDivider: '#e2eaf4',
  stepPhotoBg: '#e8eef5',
  pageNumColor: '#7a90a8',
  introBorderLeft: '#1a6b8a',
  hintIcon: '#8aafcc',
  stepHeaderBg: '#0f4c62',
  stepNumBg: 'rgba(255,255,255,0.15)',
} as const;

export type PrintableMapPoint = {
  lat: number;
  lng: number;
  num: number;
  location: string;
};
