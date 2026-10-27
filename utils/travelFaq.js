/* global module, require */
const { htmlToPlainText } = require('./seoText')

const FAQ_SECTION_OPEN_TAG = '<section[^>]*(?:class="[^"]*seo-faq[^"]*"|data-faq="metravel-seo")[^>]*>'

function extractFaqEntries(descriptionHtml) {
  const html = String(descriptionHtml || '')
  if (!html.includes('<details')) return []
  const faqSections = html.match(new RegExp(`${FAQ_SECTION_OPEN_TAG}[\\s\\S]*?<\\/section>`, 'gi'))
  const entries = []
  for (const scope of faqSections?.length ? faqSections : [html]) {
    for (const block of scope.match(/<details[\s\S]*?<\/details>/gi) || []) {
      if (!faqSections?.length && !/itemprop\s*=\s*["']mainEntity["']/i.test(block)) continue
      const summary = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
      if (!summary) continue
      const question = htmlToPlainText(summary[1])
      const answer = htmlToPlainText(block.slice(summary.index + summary[0].length))
      if (question && answer) entries.push({ question, answer })
    }
  }
  return entries
}

function buildTravelFaqJsonLd(descriptionHtml) {
  const entries = extractFaqEntries(descriptionHtml)
  if (!entries.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

module.exports = { FAQ_SECTION_OPEN_TAG, extractFaqEntries, buildTravelFaqJsonLd }
