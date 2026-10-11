#!/usr/bin/env node
/**
 * Seal the v1 quest SEO package of a finished dist (#2365 B).
 *
 * Runs AFTER every step that rewrites HTML bytes (post-processing, cache-bust
 * meta, charset normalization, `.build-source.json`): takes receipt R2,
 * requires it to equal the R1 recorded by `generate-seo-pages.js
 * --quest-seo-candidate`, hashes the stored bytes, verifies the whole package
 * and writes `quest-seo-manifest.v1.json` last. Any failure exits nonzero with
 * no manifest: the candidate is rejected whole, the previously activated
 * package stays as it is.
 *
 * Usage:
 *   node scripts/finalize-quest-seo-package.js --dist dist/prod --candidate <file> \
 *     [--receipt-command "<cmd>"] [--release-id <id>]
 * The receipt command defaults to $QUEST_SEO_RECEIPT_COMMAND. Activation and
 * exposure stay with E/D (`quest_seo_activate`), never with this script.
 */

const path = require('path')
const { finalizeQuestSeoPackage, runRevisionReceiptCommand } = require('./lib/questLocalePackage')

function getArg(args, name, fallback = '') {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

function main(argv = process.argv.slice(2)) {
  const distDir = path.resolve(getArg(argv, 'dist', 'dist/prod'))
  const candidatePath = getArg(argv, 'candidate')
  if (!candidatePath) throw new Error('--candidate <file> is required')
  const command = getArg(argv, 'receipt-command', process.env.QUEST_SEO_RECEIPT_COMMAND || '')
  return finalizeQuestSeoPackage({
    distDir,
    candidatePath: path.resolve(candidatePath),
    releaseId: getArg(argv, 'release-id') || undefined,
    takeReceipt: () => runRevisionReceiptCommand(command),
    log: (line) => console.log(line),
  })
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`❌ quest SEO package rejected: ${error.message}`)
    process.exit(1)
  }
}

module.exports = { main }
