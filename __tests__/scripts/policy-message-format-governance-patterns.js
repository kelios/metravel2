// Pattern responsibilities:
// - policyUtilsRequirePattern: checks shared source module presence.
// - builderImportPattern: checks builder is imported from that shared source.
// - builderCallPattern: checks builder call usage (source-agnostic by design).
const policyUtilsRequirePattern = /require\(['"]\.\/policy-test-utils['"]\)/
const builderImportPattern = /\{[\s\S]*\bbuildForbiddenUsageMessage\b[\s\S]*\}\s*=\s*require\(['"]\.\/policy-test-utils['"]\)/
const builderCallPattern = /\bbuildForbiddenUsageMessage\s*\(/

module.exports = {
  policyUtilsRequirePattern,
  builderImportPattern,
  builderCallPattern,
}
