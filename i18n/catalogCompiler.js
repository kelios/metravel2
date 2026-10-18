/* global module */

const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/

const hashTranslationKey = (key) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// Shared by the production web build and the development web runtime. Keep
// literal and plural insertion order: explicit suffix keys remain addressable.
const compileLocaleCatalog = (resources) => {
  const catalog = new Map()
  for (const [namespace, entries] of Object.entries(resources)) {
    for (const [key, value] of Object.entries(entries)) {
      catalog.set(hashTranslationKey(`${namespace}:${key}`), { value })
    }
    for (const [key, value] of Object.entries(entries)) {
      const suffixMatch = key.match(PLURAL_SUFFIX_PATTERN)
      const baseKey = suffixMatch ? key.slice(0, -suffixMatch[0].length) : key
      const hasBase = Object.prototype.hasOwnProperty.call(entries, baseKey)
      const translationKey = `${namespace}:${hasBase ? baseKey : key}`
      const hash = hashTranslationKey(translationKey)
      const current = catalog.get(hash) ?? {
        value: hasBase ? entries[baseKey] : value,
      }
      if (suffixMatch && hasBase) {
        current.plurals = { ...current.plurals, [suffixMatch[1]]: value }
      } else {
        current.value = value
      }
      catalog.set(hash, current)
    }
  }
  return catalog
}

module.exports = { hashTranslationKey, compileLocaleCatalog }
