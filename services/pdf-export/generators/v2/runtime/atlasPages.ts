// services/pdf-export/generators/v2/runtime/atlasPages.ts
// Атлас путешествий: глобальная карта со всеми точками книги + указатель «точки → страница»
// Фасад: публичный API реэкспортируется из ./atlas/*

export { getAtlasTravelsWithMap, shouldRenderAtlas } from './atlas/entries'
export { getAtlasPageCount } from './atlas/paging'
export { renderAtlasPages } from './atlas/render'
export type { RenderAtlasPagesArgs } from './atlas/types'
