// @ts-check
// Node < 20 does not implement Array.prototype.toReversed/toSorted/etc.
// Metro's config loader uses `toReversed()` in recent versions.
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function toReversed() {
      return Array.prototype.slice.call(this).reverse()
    },
    writable: true,
    configurable: true,
  })
}

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Отключаем кастомный FileStore от Expo
config.cacheStores = [];

// Блокируем react-native-maps на веб на уровне blockList
// Инициализируем blockList как массив, если его нет
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
} else if (!Array.isArray(config.resolver.blockList)) {
  // Если blockList не массив, преобразуем в массив
  config.resolver.blockList = [config.resolver.blockList];
}
// Блокируем jsPDF (используем только pdf-lib из-за проблем с html2canvas)
//config.resolver.blockList.push(/node_modules\/jspdf\/.*/);
// Добавляем react-native-maps в blockList только для веб (через resolver)

// Настройка resolver для исключения react-native-maps на веб
const originalResolveRequest = config.resolver.resolveRequest
config.resolver = {
  ...config.resolver,
  // Prefer CommonJS "main" over ESM for better compatibility on web.
  // This avoids cases where packages (e.g. react-native-svg) resolve to an ESM build
  // that Metro/web ends up bundling incorrectly, leading to runtime export mismatches.
  resolverMainFields: ['react-native', 'browser', 'main', 'module'],
  assetExts: Array.from(new Set([...(config.resolver.assetExts || []), 'ico'])),
  resolveRequest: (context, moduleName, platform, modulePath) => {
    const isWeb = platform === 'web' || (context && context.platform === 'web');
    
    // ✅ FIX: Force CJS resolution for @babel/runtime helpers on web
    // @babel/runtime v7.26+ exports ESM by default via package.json "exports",
    // but Metro/Expo bundler expects CJS format for helpers.
    // Without this fix, you get: "TypeError: _objectWithoutPropertiesLoose is not a function"
    if (moduleName.startsWith('@babel/runtime/helpers/')) {
      const helperName = moduleName.replace('@babel/runtime/helpers/', '');
      // Use the CJS version directly (not the ESM .js in exports)
      const cjsPath = path.resolve(
        __dirname,
        'node_modules/@babel/runtime/helpers',
        helperName + '.js'
      );
      // Check if file exists, otherwise fallback
      if (fs.existsSync(cjsPath)) {
        return {
          filePath: cjsPath,
          type: 'sourceFile',
        };
      }
    }

    // react-leaflet: Let Metro bundle it normally
    // The "Cannot redefine property: default" error during hot-reload is handled
    // by the Object.defineProperty patch in entry.js

    // Блокируем импорт всех CSS файлов (Metro не может их обработать из-за lightningcss)
    if (moduleName.endsWith('.css')) {
      return {
        filePath: path.resolve(__dirname, 'metro-stubs/empty.js'),
        type: 'sourceFile',
      };
    }

    // Fix ESM/CJS interop for TanStack React Query on web.
    // Metro sometimes resolves the CJS entry (.cjs) for this package, which can drop named exports
    // and cause runtime errors like: (0, r(...).useQuery) is not a function.
    // Force the ESM build for web bundles.
    if (isWeb && moduleName === '@tanstack/react-query') {
      return {
        filePath: path.resolve(__dirname, 'node_modules/@tanstack/react-query/build/modern/index.js'),
        type: 'sourceFile',
      };
    }

    // Avoid SVG icon stacks on web: lucide-react-native depends on react-native-svg.
    // If any web-rendered UI accidentally imports lucide-react-native, resolve it to a stub.
    if (isWeb) {
      const normalizedModuleName = moduleName.replace(/\\/g, '/');
      if (
        normalizedModuleName === 'lucide-react-native' ||
        normalizedModuleName.startsWith('lucide-react-native/')
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/lucide-react-native.js'),
          type: 'sourceFile',
        };
      }

      // Exclude react-native-webview from web bundles. Some Expo DOM runtime paths
      // may attempt to resolve it even if we never render it on web.
      if (
        normalizedModuleName === 'react-native-webview' ||
        normalizedModuleName.startsWith('react-native-webview/')
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/react-native-webview.js'),
          type: 'sourceFile',
        };
      }

      // Exclude react-native-gesture-handler from web bundles.
      // It pulls in react-native-reanimated and is only needed for native.
      if (
        normalizedModuleName === 'react-native-gesture-handler' ||
        normalizedModuleName.startsWith('react-native-gesture-handler/')
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/react-native-gesture-handler.js'),
          type: 'sourceFile',
        };
      }
    }

    // Исключаем html2canvas для jsPDF (не нужен для нашего использования)
    if (moduleName === 'html2canvas' || moduleName.includes('html2canvas')) {
      // Возвращаем пустой stub для html2canvas
      return {
        filePath: path.resolve(__dirname, 'metro-stubs/html2canvas.js'),
        type: 'sourceFile',
      };
    }

    // Exclude Leaflet from the web entry bundle. We load Leaflet via CDN at runtime and
    // provide it to code via a lightweight stub that proxies window.L.
    if (isWeb) {
      const normalizedModuleName = moduleName.replace(/\\/g, '/');
      const normalizedModuleNameNoDotSlash = normalizedModuleName.replace(/^\.\//, '');
      const isLeaflet =
        moduleName === 'leaflet' ||
        normalizedModuleName === 'leaflet' ||
        moduleName.startsWith('leaflet/') ||
        normalizedModuleName.startsWith('leaflet/') ||
        // Some bundles (or accidental imports) may reference the CDN path without a host,
        // e.g. "./leaflet@1.9.4/dist/leaflet". Treat it as Leaflet too.
        normalizedModuleNameNoDotSlash.startsWith('leaflet@');

      if (isLeaflet) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/leaflet.js'),
          type: 'sourceFile',
        };
      }
      
      // Note: react-leaflet is ESM module, handled by Metro's ESM support
      // It's loaded via async import() and depends on leaflet (stub) which proxies to window.L from CDN

      if (
        moduleName === '@expo/vector-icons/MaterialCommunityIcons' ||
        normalizedModuleName === '@expo/vector-icons/MaterialCommunityIcons' ||
        moduleName === 'react-native-vector-icons/MaterialCommunityIcons' ||
        normalizedModuleName === 'react-native-vector-icons/MaterialCommunityIcons'
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/MaterialCommunityIcons.js'),
          type: 'sourceFile',
        };
      }
    }
    // На веб заменяем react-native-maps на пустой stub
    // Проверяем platform напрямую и через context
    if (isWeb) {
      // Проверяем точное совпадение или вхождение react-native-maps
      // Это включает все подмодули react-native-maps
      // Важно: проверяем все возможные варианты импорта
      const normalizedModuleName = moduleName.replace(/\\/g, '/');
      const isReactNativeMaps = 
        moduleName === 'react-native-maps' ||
        normalizedModuleName === 'react-native-maps' ||
        moduleName.startsWith('react-native-maps/') ||
        normalizedModuleName.startsWith('react-native-maps/') ||
        moduleName.includes('react-native-maps/lib') ||
        normalizedModuleName.includes('react-native-maps/lib') ||
        moduleName.includes('react-native-maps/src') ||
        normalizedModuleName.includes('react-native-maps/src');
      
      if (isReactNativeMaps) {
        const stubPath = path.resolve(__dirname, 'metro-stubs/react-native-maps.js');
        try {
          return {
            filePath: stubPath,
            type: 'sourceFile',
          };
        } catch (e) {
          console.warn('[Metro] Failed to resolve stub for react-native-maps:', e);
        }
      }
      // Заменяем Map.ios на пустой stub на веб (проверяем различные форматы путей)
      if (
        moduleName.includes('Map.ios') ||
        moduleName.endsWith('/Map.ios') ||
        moduleName.includes('components/Map.ios') ||
        moduleName === '@/components/Map.ios' ||
        (modulePath && modulePath.includes('Map.ios'))
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/Map.ios.js'),
          type: 'sourceFile',
        }
      }
      // Также заменяем MapPage/Map.ios
      if (
        moduleName.includes('MapPage/Map.ios') ||
        moduleName.endsWith('MapPage/Map.ios')
      ) {
        return {
          filePath: path.resolve(__dirname, 'metro-stubs/Map.ios.js'),
          type: 'sourceFile',
        }
      }
    }
    // Используем оригинальный resolver для остальных случаев
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform, modulePath)
    }
    return context.resolveRequest(context, moduleName, platform, modulePath)
  },
  // Добавляем html2canvas в extraNodeModules для правильного разрешения
  extraNodeModules: {
    ...(config.resolver.extraNodeModules || {}),
    'html2canvas': path.resolve(__dirname, 'metro-stubs/html2canvas.js'),
    'leaflet': path.resolve(__dirname, 'metro-stubs/leaflet.js'),
    '@expo/vector-icons/MaterialCommunityIcons': path.resolve(__dirname, 'metro-stubs/MaterialCommunityIcons.js'),
    'react-native-vector-icons/MaterialCommunityIcons': path.resolve(__dirname, 'metro-stubs/MaterialCommunityIcons.js'),
    'react-native-gesture-handler': path.resolve(
      __dirname,
      'metro-stubs/react-native-gesture-handler.js'
    ),
    'react-native-webview': path.resolve(__dirname, 'metro-stubs/react-native-webview.js'),
  },
}


// ✅ ОПТИМИЗАЦИЯ: Конфигурация transformer для Expo 54
// Включаем поддержку ESM модулей (необходимо для react-leaflet v5)
const isProd = process.env.NODE_ENV === 'production';
const isWeb = process.env.EXPO_PLATFORM === 'web' || process.argv.some(arg => arg.includes('web'));

// Базовая конфигурация transformer с поддержкой ESM
const transformerConfig = {
  ...config.transformer,
  unstable_allowRequireContext: true,
  getTransformOptions: async () => ({
    transform: {
      // ✅ Включаем экспериментальную поддержку импортов для ESM и tree-shaking
      experimentalImportSupport: true,
      // Inline requires только в production для оптимизации
      inlineRequires: isProd,
    },
  }),
};

// Добавляем production-специфичные настройки
if (isProd) {
  transformerConfig.minifierConfig = {
    ...config.transformer.minifierConfig,
    keep_classnames: false,
    keep_fnames: false,
    // ✅ Агрессивная минификация
    compress: {
      drop_console: true,
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.debug', 'console.info'],
      passes: 2,
    },
    mangle: {
      ...config.transformer.minifierConfig?.mangle,
      keep_classnames: false,
      keep_fnames: false,
      toplevel: true,
    },
  };
}

// Применяем конфигурацию (используем Object.assign для обхода read-only)
Object.assign(config.transformer, transformerConfig);

// ✅ Для web платформы (как в dev, так и в prod) используем правильные условия для ESM разрешения
// Это гарантирует, что ESM пакеты как react-leaflet загружаются корректно
if (isProd || isWeb) {
  // ✅ НОВОЕ: Bundle splitting для лучшего кеширования (только в prod)
  if (isProd) {
    config.resolver.assetExts = [...config.resolver.assetExts, 'webp', 'avif']
  }

  // ✅ Включаем ESM разрешение с правильными условиями для web
  config.resolver.unstable_enablePackageExports = true;
  config.resolver.unstable_conditionNames = [
    'react-native',
    'browser',
    'require',
    'import', // ✅ Добавляем 'import' для явной поддержки ESM пакетов в dev режиме
  ];
  
  // Configure for better web performance
  if (isWeb) {
    config.server = {
      ...config.server,
      // Enable gzip compression
      enhanceMiddleware: (middleware) => {
        return (req, res, next) => {
          return middleware(req, res, next)
        }
      }
    }
  }
}

// ✅ Проксирование запросов к API для изображений в dev режиме
// Это позволяет загружать изображения с бэкенда через localhost
const http = require('http');
const https = require('https');
const url = require('url');

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Serve static assets from public directory
      if (req.url && req.url.startsWith('/assets/')) {
        const publicPath = path.join(__dirname, 'public', req.url);
        if (fs.existsSync(publicPath)) {
          const ext = path.extname(publicPath).toLowerCase();
          const contentTypes = {
            '.ico': 'image/x-icon',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
          };
          const contentType = contentTypes[ext] || 'application/octet-stream';
          
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
          });
          fs.createReadStream(publicPath).pipe(res);
          return;
        }
      }

      // Проксируем запросы к изображениям на API сервер
      const proxyPaths = ['/api/', '/api', '/travel-image/', '/address-image/', '/gallery/', '/uploads/', '/media/'];
      const shouldProxy = proxyPaths.some(p => req.url && req.url.startsWith(p));
      
      if (shouldProxy) {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
        if (apiUrl) {
          const apiBase = apiUrl.replace(/\/api\/?$/, '');
          const targetUrl = apiBase + req.url;
          
          const parsedUrl = url.parse(targetUrl);
          const httpModule = parsedUrl.protocol === 'https:' ? https : http;
          
          const proxyReq = httpModule.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.path,
            method: req.method,
            headers: {
              ...req.headers,
              host: parsedUrl.host,
            },
          }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          });
          
          proxyReq.on('error', (err) => {
            console.error('[Metro Proxy] Error:', err.message);
            res.writeHead(502);
            res.end('Proxy Error');
          });
          
          req.pipe(proxyReq);
          return;
        }
      }
      
      return middleware(req, res, next);
    };
  },
};

module.exports = config
