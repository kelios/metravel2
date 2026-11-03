#!/usr/bin/env node
'use strict';

const { assertCodeHealth, verifyCodeHealth, createReadinessTiming } = require('./lib/ssrDeploymentReadiness');
const { parseCliArgs, runCli } = require('./lib/cli-contract');
const { verifyLiveWebSsr } = require('./verify-live-web-ssr');
const { verifyLiveQuestSsr, printQuestReadiness } = require('./verify-live-quest-ssr');

async function verifyLiveDeploymentSsr({ sha, controlPath, origin, codeHealth = verifyCodeHealth }) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Full source SHA is required');
  const releaseTiming = createReadinessTiming();
  const articleTiming = createReadinessTiming();
  const questTiming = createReadinessTiming();
  try {
    // The release lock holds the same published client/renderer pair throughout
    // both read-only probes. Each successful document still proves its own SHA.
    const proof = await releaseTiming.measure('verify-code', async () => assertCodeHealth(await codeHealth(sha), sha));
    const options = { sha, origin, mode: 'deployment', codeHealth: async () => proof };
    // Drain both probes before allowing the shell to roll back a failed pair.
    const results = await Promise.allSettled([
      verifyLiveWebSsr({ ...options, timing: articleTiming }),
      verifyLiveQuestSsr({ ...options, controlPath, timing: questTiming }),
    ]);
    const [article, quest] = results;
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [new Error(`${index === 0 ? 'Article' : 'Quest'}: ${result.reason.message}`, { cause: result.reason })] : []);
    if (failures.length) throw new AggregateError(failures, failures.map((failure) => failure.message).join(' | '));
    if (article.value.content_status) {
      console.log(`[web-ssr-readiness] Code SHA ${sha} is ready; content=${article.value.content_status}; strict content acceptance remains required`);
    }
    printQuestReadiness(quest.value);
  } finally {
    releaseTiming.report('release');
    articleTiming.report('article');
    questTiming.report('quest');
  }
}

const CLI_SPEC = { name: 'verify-live-deployment-ssr',
  usage: 'node scripts/verify-live-deployment-ssr.js --sha <full-sha> [--control-path /quests/<city>/<slug>] [--origin https://metravel.by]',
  selection: 'none', flags: { sha: { type: 'string', required: true }, 'control-path': { type: 'string' },
    origin: { type: 'string', default: 'https://metravel.by' } } };

if (require.main === module) runCli(async () => {
  await verifyLiveDeploymentSsr(parseCliArgs(process.argv, CLI_SPEC));
}, CLI_SPEC);
