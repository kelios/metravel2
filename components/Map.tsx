// Index file for Map component - exports platform-specific version
// This file allows dynamic imports to work correctly with platform-specific components
// For web, re-export Map.web.tsx (which exports MapClientSideComponent)
// For native, re-export Map.ios.tsx (which exports Map component)

// Use platform-specific extension - Metro/Expo will automatically resolve .web.tsx or .ios.tsx
// But we need a fallback for dynamic imports, so we export the web version by default
// and let the bundler handle platform-specific resolution

// Export web version as default (most common use case)
export { default } from './Map.web';

