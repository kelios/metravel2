'use strict'

const crypto = require('node:crypto')

// Both switches must agree: the route loader is stripped from the ordinary
// static client, whereas the server export needs the loader-aware client.
function resolveWebOutput(env = process.env) {
  const output = env.METRAVEL_WEB_OUTPUT || 'static'
  const runtime = env.EXPO_PUBLIC_WEB_RUNTIME_SSR || 'false'
  const questRuntime = env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR || 'false'
  if (!['static', 'server'].includes(output)) {
    throw new Error('METRAVEL_WEB_OUTPUT must be static or server')
  }
  if (!['true', 'false'].includes(runtime)) {
    throw new Error('EXPO_PUBLIC_WEB_RUNTIME_SSR must be true or false')
  }
  if (!['true', 'false'].includes(questRuntime) || (questRuntime === 'true' && output !== 'server')) {
    throw new Error('Quest runtime requires server output and an explicit boolean flag')
  }
  if ((output === 'server') !== (runtime === 'true')) {
    throw new Error('Server output requires EXPO_PUBLIC_WEB_RUNTIME_SSR=true; static output requires false')
  }
  return output
}

function resolveWebSsrCapability(value) {
  if (!value || ![1, 2].includes(value.schema_version) || typeof value.available !== 'boolean'
      || typeof value.enabled !== 'boolean' || (value.enabled && !value.available)) {
    throw new Error('Invalid backend SSR capability')
  }
  let questRuntime = false
  if (value.schema_version === 2) {
    const quest = value.quest_web
    if (!quest || quest.schema_version !== 2 || quest.builder_schema !== 2
        || !Number.isInteger(quest.refresh_max_age_seconds) || quest.refresh_max_age_seconds < 1
        || quest.refresh_max_age_seconds > 30) throw new Error('Invalid backend quest SSR capability')
    questRuntime = value.enabled
  }
  return { output: value.enabled ? 'server' : 'static', questRuntime }
}

// Production publishes only the server export (#2766): entity pages are
// rendered by the SSR loaders, the static entity pipeline is gone, and the
// backend `rollback-code` returns the previous SSR pair, never a static build.
// A capability without the quest SSR runtime therefore refuses the deploy
// instead of downgrading a live SSR release to static output.
function resolveDeployWebOutput(value) {
  const capability = resolveWebSsrCapability(value)
  if (capability.output !== 'server' || !capability.questRuntime) {
    throw new Error('Production deploy publishes only SSR: backend quest SSR capability is unavailable')
  }
  return capability
}

function getQuestControlPath(value, { allowUnavailable = false } = {}) {
  const capability = resolveWebSsrCapability(value)
  const route = value.quest_web?.control_path
  if (capability.questRuntime && allowUnavailable && route == null) return null
  if (!capability.questRuntime || typeof route !== 'string'
      || !/^\/(?:(?:be|uk|pl|en)\/)?quests\/[1-9]\d*\/[A-Za-z0-9_-]+$/.test(route)) {
    throw new Error('Backend quest SSR control path is unavailable')
  }
  return route
}

// #3334: one id per rollout, generated before `publish-code` and passed to
// `publish-code`, `finalize-code` and `rollback-code`, binds the receipt on the
// host to this session (backend #3310): the helper then refuses to finalize or
// roll back another session's publication of the same revision. The id is an
// identity, not a secret. A helper that does not advertise the protocol gets
// the former calls without it — hence the empty string.
function createCodePublicationId(value, randomBytes = crypto.randomBytes) {
  resolveWebSsrCapability(value)
  return value.code_publication?.publication_id === true ? randomBytes(16).toString('hex') : ''
}

module.exports = {
  resolveWebOutput,
  resolveWebSsrCapability,
  resolveDeployWebOutput,
  getQuestControlPath,
  createCodePublicationId,
}
