/* global module, require */
const { travelAuthorProfileUrl } = require('./travelAuthorProfile')
const { readTravelContentUpdatedAt } = require('./travelContentUpdatedAt')

const SITE_URL = 'https://metravel.by'

function buildTravelArticleStructuredData({ headline, description, canonical, image, travel, language, authorSameAs }) {
  const cleanHeadline = String(headline || '').trim()
  if (!cleanHeadline || !canonical) return null
  const authorName = String(
    travel?.user?.display_name || travel?.user?.name || travel?.userName || travel?.authorName || '',
  ).trim() || 'MeTravel'
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: cleanHeadline,
    description: String(description || '').trim(),
    mainEntityOfPage: canonical,
    url: canonical,
    ...(language ? { inLanguage: language } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'MeTravel',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/icons/logo_yellow_60x60.png` },
    },
    author: { '@type': 'Person', name: authorName },
  }
  // #3237: профиль автора на сайте.
  const authorUrl = travelAuthorProfileUrl(travel)
  if (authorUrl) payload.author.url = authorUrl
  // `sameAs` — только соцсети из публичного профиля автора (#3240), пустые не пишем.
  if (authorUrl && Array.isArray(authorSameAs) && authorSameAs.length) payload.author.sameAs = authorSameAs.slice()
  if (image) payload.image = [image]
  const publishedAt = travel?.created_at || travel?.date_create || travel?.datePublished || null
  // #3237: `dateModified` — честная дата правки содержания (`content_updated_at`,
  // #3240); её нет — дата публикации. Технический `updated_at` сюда не идёт.
  const modifiedAt = readTravelContentUpdatedAt(travel) || publishedAt
  if (publishedAt) payload.datePublished = publishedAt
  if (modifiedAt) payload.dateModified = modifiedAt
  return payload
}

function buildTravelBreadcrumbStructuredData({ headline, canonical }) {
  if (!headline || !canonical) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Путешествия', item: `${SITE_URL}/travelsby` },
      { '@type': 'ListItem', position: 3, name: headline, item: canonical },
    ],
  }
}

module.exports = { buildTravelArticleStructuredData, buildTravelBreadcrumbStructuredData }
