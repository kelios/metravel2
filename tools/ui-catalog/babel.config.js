/* global __dirname, module, require */
const path = require('node:path')

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [require.resolve('../../i18n/babel-inline-plugin'), {
      projectRoot: path.resolve(__dirname, '../..'),
    }],
  ],
}
