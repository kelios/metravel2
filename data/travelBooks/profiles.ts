/** Physical book dimensions shared by browser metadata and authoring validation. */
export const BOOK_PROFILES = {
  'pocket-150x100': {widthMm: 150, heightMm: 100, minBodyPt: 9, photoMm: {width: 100, height: 70}, qrMm: 18},
  'album-a5': {widthMm: 148, heightMm: 210, minBodyPt: 10.5, photoMm: {width: 108, height: 158}, qrMm: 20},
} as const;
