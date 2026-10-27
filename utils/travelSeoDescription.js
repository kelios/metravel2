/* global module, require */
const {
  htmlToPlainText, normalizeSeoLead, finishTruncatedSnippet,
  clampDescriptionForAttr, getStoredTravelSeoDescription,
} = require('./seoText')

function truncateSeoText(html, maxLength = 160) {
  const plain = htmlToPlainText(html)
  if (plain.length <= maxLength) return plain
  const window = plain.slice(0, maxLength)
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (sentenceEnd >= Math.floor(maxLength * 0.6)) return window.slice(0, sentenceEnd + 1)
  const cut = plain.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const onWord = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return finishTruncatedSnippet(onWord) || `${cut}…`
}

/** Canonical editorial metadata: preserve the published SSG description formula. */
function buildTravelSeoDescription(travel, detailDescription, detailMetaDescription) {
  const stored = getStoredTravelSeoDescription(detailMetaDescription)
  if (stored) return stored
  const primary = truncateSeoText(normalizeSeoLead(htmlToPlainText(detailDescription || travel?.description || '')))
  const fallbackParts = [String(travel?.name || '').trim(), String(travel?.countryName || '').trim()].filter(Boolean)
  const contextual = fallbackParts.length
    ? `${fallbackParts.join(' — ')}. Маршрут, советы и впечатления путешественников в MeTravel.`
    : 'Найди место для путешествия и поделись своим опытом.'
  if (primary.length >= 80) return clampDescriptionForAttr(primary, 160)
  if (primary) {
    return clampDescriptionForAttr(`${primary.replace(/[.!?…\s]+$/g, '')}. ${contextual}`.replace(/\s+/g, ' ').trim(), 160)
  }
  return clampDescriptionForAttr(contextual, 160)
}

module.exports = { buildTravelSeoDescription, truncateSeoText }
