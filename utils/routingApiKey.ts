import {
  getRoutingConfigDiagnosticsCore,
  resolveRoutingApiKeyWithSourceCore,
} from '@/utils/runtimeConfigContract';
import type {
  RoutingApiEnv,
  RoutingApiKeyResolution,
  RoutingConfigDiagnostic,
} from '@/utils/runtimeConfigContract';

/**
 * Resolve routing API key from supported env aliases.
 * Keeps backward compatibility with legacy project/env naming.
 */
export const resolveRoutingApiKey = (env: RoutingApiEnv = (process as any)?.env ?? {}): string | undefined => {
  return resolveRoutingApiKeyWithSourceCore(env).key;
};

export const resolveRoutingApiKeyWithSource = (
  env: RoutingApiEnv = (process as any)?.env ?? {}
): RoutingApiKeyResolution => {
  return resolveRoutingApiKeyWithSourceCore(env);
};

export const getRoutingConfigDiagnostics = (
  env: RoutingApiEnv = (process as any)?.env ?? {}
): RoutingConfigDiagnostic[] => {
  return getRoutingConfigDiagnosticsCore(env);
};

export type { RoutingApiEnv, RoutingApiKeyResolution, RoutingConfigDiagnostic };

