// Node/Jest fallback. Metro chooses `.web.ts` for web and `.native.ts` for
// iOS/Android, so the browser-only HEIC/WASM decoder cannot enter native bundles.
export * from './webImageUpload.web';
