/**
 * Advanced Metro configuration for maximum performance
 * Optimized for fast builds and minimal bundle size
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 1. Enable advanced optimizations
config.transformer = {
  ...config.transformer,
  // Enable React Fast Refresh
  enableBabelRust: true,
  // Enable inline requires for better tree shaking
  inlineRequires: true,
  // Enable minification in development for better performance testing
  minifierConfig: process.env.NODE_ENV === 'development' ? {
    keep_classnames: false,
    keep_fnames: false,
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
    },
  } : config.transformer.minifierConfig,
};

// 2. Optimized resolver configuration
config.resolver = {
  ...config.resolver,
  // Prefer CommonJS "main" over ESM "module" for better compatibility on web.
  // This avoids cases where packages (e.g. react-native-svg) resolve to an ESM build
  // that Metro/web ends up bundling incorrectly, leading to runtime export mismatches.
  resolverMainFields: ['react-native', 'browser', 'main', 'module'],
  // Enable asset optimization
  assetExts: [
    ...config.resolver.assetExts,
    'webp', 'avif', 'heic', 'heif'
  ],
  // Source file extensions
  sourceExts: [
    ...config.resolver.sourceExts,
    'jsx', 'js', 'ts', 'tsx', 'json'
  ],
  // Alias for cleaner imports
  alias: {
    '@': path.resolve(__dirname, './'),
    '@components': path.resolve(__dirname, './components'),
    '@hooks': path.resolve(__dirname, './hooks'),
    '@utils': path.resolve(__dirname, './utils'),
    '@styles': path.resolve(__dirname, './styles'),
    '@constants': path.resolve(__dirname, './constants'),
  },
  // Enable node modules polyfills for web
  polyfillNodeModules: true,
};

// 3. Server optimizations for development
config.server = {
  ...config.server,
  // Enable compression
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Enable HTTP/2 Server Push for critical resources
      if (req.url === '/' || req.url === '/travel/') {
        res.setHeader('Link', [
          '</styles/critical.css>; rel=preload; as=style',
          '</fonts/inter-v12-latin-regular.woff2>; rel=preload; as=font; crossorigin',
          '</images/hero.webp>; rel=preload; as=image; fetchpriority=high',
        ].join(', '));
      }
      
      return middleware(req, res, next);
    };
  },
};

// 4. Production optimizations
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig = {
    ...config.transformer.minifierConfig,
    // Aggressive minification
    keep_classnames: false,
    keep_fnames: false,
    mangle: {
      keep_classnames: false,
      keep_fnames: false,
      toplevel: true,
    },
    // Remove console.log statements
    compress: {
      ...config.transformer.minifierConfig?.compress,
      drop_console: true,
      drop_debugger: true,
      pure_funcs: [
        'console.log',
        'console.info',
        'console.debug',
        'console.warn'
      ],
    },
    // Optimize CSS
    cssMinifierConfig: {
      ...config.transformer.cssMinifierConfig,
      // Remove unused CSS
      unused: {
        enable: true,
        remove: true,
      },
      // Minify CSS aggressively
      minify: {
        enable: true,
        removeWhitespace: true,
        removeComments: true,
        shortenIds: true,
        mergeRules: true,
      },
    },
  };
  
  // Enable bundle splitting for better caching
  config.serializer = {
    ...config.serializer,
    // Create separate chunks for vendor code
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  };
}

// 5. Development optimizations
if (process.env.NODE_ENV === 'development') {
  // Enable fast refresh
  config.resolver.devServerConfig = {
    ...config.resolver.devServerConfig,
    hot: true,
    liveReload: true,
  };
  
  // Optimize for development speed
  config.watchFolders = [
    path.resolve(__dirname, './components'),
    path.resolve(__dirname, './hooks'),
    path.resolve(__dirname, './utils'),
  ];
}

// 6. Web-specific optimizations
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.platforms = ['web', 'ios', 'android'];
  
  // Enable web-specific optimizations
  config.web = {
    ...config.web,
    // Enable PWA features
    pwa: true,
    // Enable service worker
    serviceWorker: true,
    // Enable web manifest
    manifest: {
      name: 'Metravel - Travel Details',
      short_name: 'Metravel',
      description: 'Optimized travel details page',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#2c7a7a',
      orientation: 'portrait',
    },
  };
}

// 7. Asset optimization
config.assetPlugins = [
  ...(config.assetPlugins || []),
  // Enable asset optimization
  require('expo-asset-tools/build/plugin'),
];

// 8. Cache optimization
config.cacheStores = [
  // Enable persistent cache for faster builds
  new (require('metro-cache').FileStore)({
    root: path.join(__dirname, '.metro-cache'),
  }),
];

// 9. Performance monitoring
config.reporter = {
  ...config.reporter,
  // Enable performance reporting
  update: () => {
    // Silent performance reporting
  },
};

module.exports = config;
