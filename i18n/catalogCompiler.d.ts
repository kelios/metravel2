export type CompiledPluralForms = Partial<Record<Intl.LDMLPluralRule, string>>
export type LoadedTranslation = { value: string; plurals?: CompiledPluralForms }
export type LocaleResources = Record<string, Record<string, string>>

export function hashTranslationKey(key: string): number
export function compileLocaleCatalog(resources: LocaleResources): Map<number, LoadedTranslation>
