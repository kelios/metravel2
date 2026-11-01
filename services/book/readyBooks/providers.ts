import type {PrintDirectory, PrintCountry, PrintProvider} from '../../../data/travelBooks/schema/providers';

export type PrintLocation = PrintProvider & {printHelp: NonNullable<PrintProvider['printHelp']>};

/** A public directory, not a quote or acceptance of a particular PDF. */
export function listPrintLocations(country: PrintCountry, directory: PrintDirectory): PrintLocation[] {
  return directory.providers.filter((provider): provider is PrintLocation => provider.country === country && Boolean(provider.printHelp));
}
