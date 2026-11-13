import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reuse a real, verified image rather than a browser-only placeholder PNG. */
export function liveUploadImage(name = 'e2e-live-upload.webp') {
  return {
    name,
    mimeType: 'image/webp',
    buffer: readFileSync(resolve('assets/images/cover_bled.webp')),
  };
}
