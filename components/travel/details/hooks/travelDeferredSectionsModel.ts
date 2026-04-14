export const TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS = {
  author: {
    fallbackDelay: 500,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:author:visible',
  },
  comments: {
    fallbackDelay: 950,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:comments:visible',
  },
  footer: {
    fallbackDelay: 1000,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:footer:visible',
  },
  map: {
    fallbackDelay: 800,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:map:visible',
  },
  rating: {
    fallbackDelay: 600,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:rating:visible',
  },
  sidebar: {
    fallbackDelay: 900,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:sidebar:visible',
  },
} as const
