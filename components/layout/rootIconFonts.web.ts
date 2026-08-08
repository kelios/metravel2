// Web icon components inject their own font faces. Keeping native font modules
// out of the root graph avoids shipping their full glyph maps on every page.
export const ROOT_ICON_FONTS = {}
