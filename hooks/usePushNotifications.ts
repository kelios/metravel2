// Compatibility shim for tooling that expects a base module path.
// Runtime platform resolution still prefers `.native.ts` / `.web.ts`.
export * from './usePushNotifications.native';

