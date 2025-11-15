// @ts-check
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

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
