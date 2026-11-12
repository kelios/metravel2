/* global module */

// Quest.tags is a JSONField(default=list) on the backend: untouched rows keep a
// list of slugs, rows edited in the admin carry a `{tag: true}` map. This is the
// one reading of both shapes, shared by the SSR discovery projection and the app
// adapters, so a list never turns into index keys `'0'..'n'` on one side only.

/** List of strings or map → `{tag: boolean}`; absent → `{}`; any other shape → null. */
function normalizeQuestTags(value) {
  if (value == null) return {};
  if (Array.isArray(value)) {
    return value.every((tag) => typeof tag === 'string') ? Object.fromEntries(value.map((tag) => [tag, true])) : null;
  }
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value).map(([tag, enabled]) => [tag, Boolean(enabled)]));
}

/** Enabled tag slugs — what a rule over tags reads: a `{tag: false}` entry, absent tags and unknown shapes give none. */
function enabledQuestTags(value) {
  return Object.entries(normalizeQuestTags(value) ?? {}).filter(([, enabled]) => enabled).map(([tag]) => tag);
}

/** Tags as the app reads `meta.tags`: the enabled slugs, with absent kept distinct as undefined. */
function questTagNames(value) {
  if (value == null) return undefined;
  return enabledQuestTags(value);
}

module.exports = { normalizeQuestTags, questTagNames, enabledQuestTags };
