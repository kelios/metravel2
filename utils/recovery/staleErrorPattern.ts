const STALE_ERROR_PATTERN_PARTS = [
  'requiring unknown module',
  'cannot find module',
  'loading chunk',
  'failed to fetch dynamically imported module',
  'loading module.*failed',
  'chunkloaderror',
  'asyncrequireerror',
  'getfilterspanelstyles.*is not a function',
  'usesingletravelexport.*is not a function',
  'usesafeareainsets.*is not a function',
  'usebreadcrumbmodel.*is not a function',
  "class constructors?.*cannot be invoked without 'new'",
  // Layout constants access errors (stale chunk accessing changed exports)
  "cannot read properties of undefined.*tabbarheight",
  "cannot read properties of undefined.*headerheight",
] as const;

export const STALE_ERROR_PATTERN_SOURCE = STALE_ERROR_PATTERN_PARTS.join('|');
export const STALE_ERROR_REGEX = new RegExp(STALE_ERROR_PATTERN_SOURCE, 'i');
