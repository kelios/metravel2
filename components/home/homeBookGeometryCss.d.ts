export type HomeBookCssSelectors = { book: string; page: string; title: string; subtitle: string; week: string };
export function buildHomeBookGeometryCSS(selectors?: HomeBookCssSelectors, options?: { important?: boolean }): string;
