import data from '../../../data/travelBooks/providers.json';
import type {PrintDirectory, PrintCountry, PrintProvider} from '../../../data/travelBooks/schema/providers';
import type {PrintProfile} from '../../../types/readyBook';

// The publication validator checks this registry before release; the UI reads only metadata.
export const printDirectory = data as PrintDirectory;
export type PrintProviderQuery = {
  country: PrintCountry; city: string; profileId: PrintProfile['id']; copies: number;
  bodyPageCount: number; binding: PrintProfile['binding']; artifactSha256?: string;
};
export type ProviderExclusion = 'copies' | 'format' | 'binding' | 'pages' | 'ruPdf';
export type ProviderMatch = {
  provider: PrintProvider; fulfillment: 'local' | 'delivery';
  exclusions: ProviderExclusion[]; confirmedFile: boolean;
};

export function bookPrintBindings(profileId: PrintProfile['id']): PrintProfile['binding'][] {
  return profileId === 'album-a5' ? ['spiral', 'rings', 'sewn'] : ['spiral', 'rings'];
}

/** A candidate has no known conflict. Unknown parameters never become confirmation. */
export function resolvePrintProviders(query: PrintProviderQuery, providers: PrintProvider[] = printDirectory.providers): ProviderMatch[] {
  if (!Number.isSafeInteger(query.copies) || query.copies < 1 || !Number.isSafeInteger(query.bodyPageCount) || query.bodyPageCount < 1) return [];
  if (!bookPrintBindings(query.profileId).includes(query.binding)) return [];
  if (!printDirectory.cities.some(city => city.country === query.country && city.name === query.city)) return [];
  return providers.filter(provider => provider.country === query.country).flatMap(provider => {
    const local = provider.city === query.city && provider.fulfillment === 'local';
    const delivery = provider.deliveryCoverage.includes(query.country) || provider.deliveryCoverage.includes(query.city);
    if (!local && !delivery) return [];
    const exclusions: ProviderExclusion[] = [];
    if (provider.minimumCopies !== null && provider.minimumCopies > query.copies) exclusions.push('copies');
    if (provider.formatsComplete && !provider.publishedProfiles.includes(query.profileId) && !provider.customFormat) exclusions.push('format');
    if (provider.bindings.length > 0 && !provider.bindings.includes(query.binding)) exclusions.push('binding');
    if ((provider.minimumBodyPages !== null && query.bodyPageCount < provider.minimumBodyPages)
      || (provider.maximumBodyPages !== null && query.bodyPageCount > provider.maximumBodyPages)
      || (provider.bodyPageMultiple !== null && query.bodyPageCount % provider.bodyPageMultiple !== 0)) exclusions.push('pages');
    if (provider.acceptsRuPdf === 'no') exclusions.push('ruPdf');
    const confirmedFile = exclusions.length === 0 && provider.acceptsRuPdf === 'yes'
      && provider.supportedProfiles.includes(query.profileId)
      && provider.acceptedFiles.some(file => file.profileId === query.profileId && file.sha256 === query.artifactSha256);
    return [{provider, fulfillment: local ? 'local' as const : 'delivery' as const, exclusions, confirmedFile}];
  });
}
