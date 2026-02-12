import { getRuntimeConfigDiagnosticsCore } from '@/utils/runtimeConfigContract';
import type { RuntimeConfigDiagnostic, RoutingApiEnv } from '@/utils/runtimeConfigContract';

export const getRuntimeConfigDiagnostics = (
  env: RoutingApiEnv = (process as any)?.env ?? {}
): RuntimeConfigDiagnostic[] => {
  return getRuntimeConfigDiagnosticsCore(env);
};

export type { RuntimeConfigDiagnostic };

