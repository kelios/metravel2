import {z} from 'zod';
import {profileId} from './profiles';

const country = z.enum(['BY', 'PL']);
const answer = z.enum(['yes', 'no', 'unknown']);
const https = z.string().url().refine(value => new URL(value).protocol === 'https:');
const positiveInteger = z.number().int().positive();
export const printProviderSchema = z.strictObject({
  id: z.string().min(1), name: z.string().min(1), country, city: z.string().min(1), url: https,
  fulfillment: z.enum(['local', 'delivery']), deliveryCoverage: z.array(z.string().min(1)),
  minimumCopies: positiveInteger.nullable(),
  // Published sizes describe a product offer, not acceptance of our actual PDF.
  publishedProfiles: z.array(profileId), customFormat: z.boolean(), formatsComplete: z.boolean(),
  bindings: z.array(z.enum(['rings', 'spiral', 'sewn', 'stapled', 'glued', 'soft', 'hard'])),
  minimumBodyPages: positiveInteger.nullable(), maximumBodyPages: positiveInteger.nullable(),
  bodyPageMultiple: positiveInteger.nullable(), genericPdfAcceptance: answer,
  acceptsRuPdf: answer, contactLanguages: z.array(z.string().min(1)), supportedProfiles: z.array(profileId),
  checkedAt: z.string().date(), sourceUrls: z.array(https).min(1),
  verification: z.enum(['published', 'sample-confirmed']),
  acceptedFiles: z.array(z.strictObject({
    profileId, sha256: z.string().regex(/^[a-f0-9]{64}$/), sourceUrl: https, checkedAt: z.string().date(),
  })),
});
export const printDirectorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  cities: z.array(z.strictObject({country, name: z.string().min(1)})),
  providers: z.array(printProviderSchema),
}).superRefine((directory, ctx) => {
  const ids = new Set<string>();
  for (const [index, provider] of directory.providers.entries()) {
    if (ids.has(provider.id)) ctx.addIssue({code: 'custom', path: ['providers', index, 'id'], message: 'Duplicate provider'});
    ids.add(provider.id);
    if (provider.acceptedFiles.some(file => !provider.supportedProfiles.includes(file.profileId))) {
      ctx.addIssue({code: 'custom', path: ['providers', index, 'acceptedFiles'], message: 'Accepted file needs a supported profile'});
    }
  }
});
export type PrintProvider = z.infer<typeof printProviderSchema>;
export type PrintCountry = z.infer<typeof country>;
