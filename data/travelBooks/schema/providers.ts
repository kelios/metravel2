import {z} from 'zod';
import {profileId} from './profiles';

const country = z.enum(['BY', 'PL']);
const answer = z.enum(['yes', 'no', 'unknown']);
const https = z.string().url().refine(value => new URL(value).protocol === 'https:');
const positiveInteger = z.number().int().positive();
const bindings = z.array(z.enum(['rings', 'spiral', 'stapled', 'glued', 'soft', 'hard']));

// Version 1 survives only inside immutable, hash-pinned book revisions; the current
// directory below replaces it and must not be edited back into this shape.
const legacyPrintProviderSchema = z.strictObject({
  id: z.string().min(1), name: z.string().min(1), country, city: z.string().min(1), url: https,
  fulfillment: z.enum(['local', 'delivery']), deliveryCoverage: z.array(z.string().min(1)),
  minimumCopies: positiveInteger.nullable(),
  publishedProfiles: z.array(profileId), customFormat: z.boolean(), formatsComplete: z.boolean(),
  bindings: z.array(z.enum(['rings', 'spiral', 'sewn', 'stapled', 'glued', 'soft', 'hard'])),
  minimumBodyPages: positiveInteger.nullable(), maximumBodyPages: positiveInteger.nullable(),
  bodyPageMultiple: positiveInteger.nullable(), genericPdfAcceptance: answer,
  acceptsRuPdf: answer, contactLanguages: z.array(z.string().min(1)), supportedProfiles: z.array(profileId),
  checkedAt: z.string().date(), sourceUrls: z.array(https).min(1),
  verification: z.enum(['published', 'sample-confirmed']),
  printHelp: z.strictObject({
    address: z.string().min(1), fontPolicy: z.enum(['embedded', 'confirm-embedded']),
    a4Printing: z.literal('published'), binding: z.literal('published'),
    technicalSourceUrl: https, serviceSourceUrl: https, addressSourceUrl: https,
  }).optional(),
  acceptedFiles: z.array(z.strictObject({
    profileId, sha256: z.string().regex(/^[a-f0-9]{64}$/), sourceUrl: https, checkedAt: z.string().date(),
  })),
});
const legacyPrintDirectorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  cities: z.array(z.strictObject({country, name: z.string().min(1)})),
  providers: z.array(legacyPrintProviderSchema),
}).superRefine((directory, ctx) => {
  const ids = new Set<string>();
  for (const [index, provider] of directory.providers.entries()) {
    if (ids.has(provider.id)) ctx.addIssue({code: 'custom', path: ['providers', index, 'id'], message: 'Duplicate provider'});
    ids.add(provider.id);
    if (provider.acceptedFiles.some(file => !provider.supportedProfiles.includes(file.profileId))) {
      ctx.addIssue({code: 'custom', path: ['providers', index, 'acceptedFiles'], message: 'Accepted file needs a supported profile'});
    }
    if (provider.printHelp && [provider.printHelp.technicalSourceUrl, provider.printHelp.serviceSourceUrl, provider.printHelp.addressSourceUrl]
      .some(url => !provider.sourceUrls.includes(url))) {
      ctx.addIssue({code: 'custom', path: ['providers', index, 'printHelp'], message: 'Printing information needs its primary sources'});
    }
  }
});

// A capability is either stated on the point's own website or unknown; we never infer "no".
const published = z.enum(['yes', 'unknown']);
export const printCityIds = {
  BY: ['minsk', 'brest', 'vitebsk', 'gomel', 'grodno', 'mogilev'],
  PL: ['warszawa', 'krakow', 'wroclaw', 'gdansk', 'poznan', 'lodz', 'katowice', 'lublin', 'szczecin', 'bialystok'],
} as const;
const cityId = z.enum([...printCityIds.BY, ...printCityIds.PL]);
export const printProviderSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), country, city: cityId,
  address: z.string().min(1), url: https,
  printing: z.strictObject({a4: published, a5: published, colour: published, pdf: published}),
  bindings,
  // A walk-in directory, not acceptance of our exact PDF: anything short of "embedded-ok" asks the reader to confirm.
  fontPolicy: z.enum(['embedded-ok', 'outlines-required', 'unknown']),
  checkedAt: z.string().date(), sourceUrls: z.array(https).min(1),
});
export const printDirectorySchema = z.strictObject({
  schemaVersion: z.literal(2),
  // Display order: the first city of a country is its default.
  cities: z.array(z.strictObject({id: cityId, country})).min(1),
  providers: z.array(printProviderSchema),
}).superRefine((directory, ctx) => {
  const cities = new Map(directory.cities.map(city => [city.id, city.country]));
  if (cities.size !== directory.cities.length) ctx.addIssue({code: 'custom', path: ['cities'], message: 'Duplicate city'});
  for (const [index, city] of directory.cities.entries()) {
    if (!(printCityIds[city.country] as readonly string[]).includes(city.id)) ctx.addIssue({code: 'custom', path: ['cities', index], message: 'City belongs to another country'});
  }
  const ids = new Set<string>();
  for (const [index, provider] of directory.providers.entries()) {
    if (ids.has(provider.id)) ctx.addIssue({code: 'custom', path: ['providers', index, 'id'], message: 'Duplicate provider'});
    ids.add(provider.id);
    if (cities.get(provider.city) !== provider.country) ctx.addIssue({code: 'custom', path: ['providers', index, 'city'], message: 'Unknown city for this country'});
    if (!provider.sourceUrls.includes(provider.url)) ctx.addIssue({code: 'custom', path: ['providers', index, 'sourceUrls'], message: 'Website must be a recorded source'});
  }
});
/** Any directory a published book revision may pin: the legacy snapshot or the current shape. */
export const publishedPrintDirectorySchema = z.union([legacyPrintDirectorySchema, printDirectorySchema]);
export type PrintProvider = z.infer<typeof printProviderSchema>;
export type PrintCountry = z.infer<typeof country>;
export type PrintCityId = z.infer<typeof cityId>;
export type PrintDirectory = z.infer<typeof printDirectorySchema>;
export type PublishedPrintDirectory = z.infer<typeof publishedPrintDirectorySchema>;
