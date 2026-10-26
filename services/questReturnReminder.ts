// Compatibility shim for tooling that expects a base module path.
// Runtime platform resolution prefers `.native.ts` / `.web.ts`.
export * from './questReturnReminder.native';
