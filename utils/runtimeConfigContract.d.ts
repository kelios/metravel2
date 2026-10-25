export type RoutingApiEnv = Partial<Record<string, string | undefined>>;

export type RoutingApiKeyCandidate =
  | 'EXPO_PUBLIC_ORS_API_KEY'
  | 'EXPO_PUBLIC_ROUTE_SERVICE_KEY'
  | 'EXPO_PUBLIC_ROUTE_SERVICE'
  | 'ORS_API_KEY'
  | 'ROUTE_SERVICE_KEY';

export type DevMockFlagName =
  | 'EXPO_PUBLIC_TRIPS_MOCK'
  | 'EXPO_PUBLIC_ACHIEVEMENTS_MOCK'
  | 'EXPO_PUBLIC_SAFETY_MOCK'
  | 'EXPO_PUBLIC_OSRM_MOCK';

export type RoutingApiKeyResolution = {
  key: string | undefined;
  source: RoutingApiKeyCandidate | undefined;
};

export type RoutingConfigDiagnostic = {
  code: 'ROUTING_KEY_MISSING' | 'ROUTING_KEY_LEGACY_ALIAS' | 'ROUTING_KEY_CONFLICT';
  message: string;
};

export type RuntimeConfigDiagnostic = {
  code:
    | 'API_URL_MISSING'
    | 'API_URL_INVALID'
    | 'API_URL_SELF_PROXY'
    | 'API_URL_UNSAFE_HTTP'
    | 'DEV_MOCK_FLAG_ENABLED'
    | 'AI_ASSISTANT_URL_INVALID'
    | 'AI_ASSISTANT_LOCAL_URL_IN_PRODUCTION'
    | 'AI_ASSISTANT_ENABLED_IN_PRODUCTION'
    | 'AI_PICKS_URL_INVALID'
    | 'AI_PICKS_LOCAL_URL_IN_PRODUCTION'
    | 'ROUTING_KEY_MISSING'
    | 'ROUTING_KEY_LEGACY_ALIAS'
    | 'ROUTING_KEY_CONFLICT';
  severity: 'warning' | 'error';
  message: string;
};

export const ROUTING_API_KEY_CANDIDATES: RoutingApiKeyCandidate[];
export const MOCK_FLAG_NAMES: DevMockFlagName[];
export const AI_ASSISTANT_FLAG_NAME: 'EXPO_PUBLIC_AI_ASSISTANT';
export const AI_ASSISTANT_URL_NAME: 'EXPO_PUBLIC_AI_ASSISTANT_URL';
export const AI_PICKS_FLAG_NAME: 'EXPO_PUBLIC_AI_PICKS';
export const AI_PICKS_URL_NAME: 'EXPO_PUBLIC_AI_PICKS_URL';

export function getAiPicksDiagnosticsCore(
  env?: RoutingApiEnv,
  options?: { isProduction?: boolean }
): RuntimeConfigDiagnostic[];

export function getAiAssistantDiagnosticsCore(
  env?: RoutingApiEnv,
  options?: { isProduction?: boolean }
): RuntimeConfigDiagnostic[];

export function resolveRoutingApiKeyWithSourceCore(env?: RoutingApiEnv): RoutingApiKeyResolution;
export function getRoutingConfigDiagnosticsCore(env?: RoutingApiEnv): RoutingConfigDiagnostic[];
export function getRuntimeConfigDiagnosticsCore(
  env?: RoutingApiEnv,
  options?: { platformOS?: string }
): RuntimeConfigDiagnostic[];
