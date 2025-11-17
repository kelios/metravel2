// @ts-check
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Блокируем react-native-maps на веб на уровне blockList
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
}
// Добавляем react-native-maps в blockList только для веб (через resolver)

// Настройка resolver для исключения react-native-maps на веб
const originalResolveRequest = config.resolver.resolveRequest
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform, modulePath) => {
    // На веб заменяем react-native-maps на пустой stub
    // Проверяем platform напрямую и через context
    const isWeb = platform === 'web' || (context && context.platform === 'web');
    
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
}

// Оптимизация для production
if (process.env.NODE_ENV === 'production') {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      ...config.transformer.minifierConfig,
      keep_classnames: false,
      keep_fnames: false,
      mangle: {
        ...config.transformer.minifierConfig?.mangle,
        keep_classnames: false,
        keep_fnames: false,
      },
    },
  }
}

module.exports = config
