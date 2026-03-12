import { getRuntimeConfigDiagnosticsCore } from '@/utils/runtimeConfigContract';
import type { RuntimeConfigDiagnostic, RoutingApiEnv } from '@/utils/runtimeConfigContract';

export const getRuntimeConfigDiagnostics = (
  env: RoutingApiEnv = (process as any)?.env ?? {}
): RuntimeConfigDiagnostic[] => {
  return getRuntimeConfigDiagnosticsCore(env);
};

type RuntimeConfigDiagnosticsGate = {
  isDev: boolean;
  isWeb: boolean;
  hostname?: string | null;
  pathname?: string | null;
};

export const shouldRunRuntimeConfigDiagnostics = ({
  isDev,
  isWeb,
  hostname,
  pathname,
}: RuntimeConfigDiagnosticsGate): boolean => {
  if (!isDev) return false;
  if (!isWeb) return true;

  const normalizedHost = String(hostname || '').trim().toLowerCase();
  if (normalizedHost === 'metravel.by' || normalizedHost === 'www.metravel.by') {
    return false;
  }

  const normalizedPath = String(pathname || '').trim();
  if (normalizedPath.startsWith('/travels/')) {
    return false;
  }

  return true;
};

export type { RuntimeConfigDiagnostic };
