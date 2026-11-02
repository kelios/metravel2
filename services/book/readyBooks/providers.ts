import type {PrintCityId, PrintDirectory, PrintCountry, PrintProvider} from '../../../data/travelBooks/schema/providers';

/** Cities of a country in directory order; the first one is the default choice. */
export function listPrintCities(country: PrintCountry, directory: PrintDirectory): PrintCityId[] {
  return directory.cities.filter(city => city.country === country).map(city => city.id);
}

/** A public directory, not a quote or acceptance of a particular PDF. */
export function listPrintLocations(city: PrintCityId, directory: PrintDirectory): PrintProvider[] {
  return directory.providers.filter(provider => provider.city === city);
}
