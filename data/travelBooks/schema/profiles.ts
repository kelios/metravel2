import { z } from 'zod';

import {BOOK_PROFILES} from '../profiles.ts';
export {BOOK_PROFILES};

export const profileId = z.enum(['pocket-150x100', 'album-a5']);
export const printProfileSchema = z.strictObject({
  id: profileId, widthMm: z.number().positive(), heightMm: z.number().positive(),
  bleedMm: z.union([z.literal(0), z.literal(2), z.literal(3)]),
  safeMm: z.number().min(5), bindingMm: z.number().min(15),
  binding: z.enum(['rings', 'spiral', 'sewn']),
}).superRefine((profile, ctx) => {
  const expected = BOOK_PROFILES[profile.id];
  if (profile.widthMm !== expected.widthMm || profile.heightMm !== expected.heightMm) {
    ctx.addIssue({code: 'custom', path: ['widthMm'], message: `Trim must be ${expected.widthMm}×${expected.heightMm} mm`});
  }
  if (profile.widthMm - profile.bindingMm - profile.safeMm < expected.photoMm.width) {
    ctx.addIssue({code: 'custom', path: ['bindingMm'], message: 'Margins must preserve the supported photo-frame width'});
  }
  if (profile.heightMm - 2 * profile.safeMm < expected.photoMm.height) {
    ctx.addIssue({code: 'custom', path: ['safeMm'], message: 'Margins must preserve the supported photo-frame height'});
  }
  if (profile.id === 'pocket-150x100' && profile.binding === 'sewn') {
    ctx.addIssue({code: 'custom', path: ['binding'], message: 'Pocket has no sewn profile'});
  }
});
