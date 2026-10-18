import { compileLocaleCatalog } from '../catalogCompiler'
import { enResources } from '../locales/en'

export const enCatalog = compileLocaleCatalog(enResources)
