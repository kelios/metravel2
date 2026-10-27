'use strict'

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

// The production switch to request-time rendering is a reviewed frontend
// commit, not a side effect of the installed backend helper (it always reports
// enabled). Committed here, it holds for every later deploy from main. Turn it
// off only after the backend `rollback-code` has retired the live SSR release:
// a static build must not be published under a still-active server release.
const WEB_SSR_ROLLOUT_ENABLED = true

function resolveDeployWebOutput(value, rolloutEnabled = WEB_SSR_ROLLOUT_ENABLED) {
  const capability = resolveWebSsrCapability(value)
  return rolloutEnabled ? capability : { output: 'static', questRuntime: false }
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

module.exports = {
  WEB_SSR_ROLLOUT_ENABLED,
  resolveWebOutput,
  resolveWebSsrCapability,
  resolveDeployWebOutput,
  getQuestControlPath,
}
