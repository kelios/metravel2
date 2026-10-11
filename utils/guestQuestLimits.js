/* global module */

// Shared by the guest progress gate, app copy and Node/SSG. Keep this leaf
// independent of storage and native modules.
const GUEST_QUEST_FREE_STEPS = 2;

module.exports = { GUEST_QUEST_FREE_STEPS };
