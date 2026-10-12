// #2389: sanitize-html requires postcss at module load, but calls it only to
// parse style attributes (`parseStyleAttributes`, on by default). The app's
// one style-allowing sanitizer, utils/sanitizeRichText.ts, turns that off and
// filters declarations itself (utils/richTextStyleFilter.ts), so on web this
// stub replaces 53 KB raw of postcss for sanitize-html's own import only.
// A future caller that allows `style` without `parseStyleAttributes: false`
// reaches this throw; sanitize-html catches it and drops the attribute, so it
// fails closed. __tests__/scripts/sanitize-html-postcss-stub.test.ts keeps
// every sanitize-html caller off this path.
function parse() {
  throw new Error('postcss is not bundled on web: pass parseStyleAttributes: false and filter style yourself')
}

module.exports = { parse }
