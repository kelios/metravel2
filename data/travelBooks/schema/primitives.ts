import { z } from 'zod';

export const identifier = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
export const nonempty = z.string().trim().min(1);
export const httpsUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}, 'Expected an HTTPS URL without credentials');
export const checkedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date');

