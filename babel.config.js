// .babelrc.js
module.exports = function (api) {
    const env = api.env();
    // Metro передаёт платформу через caller; web-only трансформы нельзя применять к native-бандлу
    const platform = api.caller((caller) => caller?.platform);
    // External plugin edits must invalidate Babel/Jest's config cache as well.
    const reactiveLocaleVersion = () => require('crypto').createHash('sha256')
        .update(require('fs').readFileSync(require.resolve('./i18n/babel-reactive-locale-plugin.js')))
        .digest('hex');
    const catalogCompilerVersion = () => {
        const hash = require('crypto').createHash('sha256');
        for (const file of [require.resolve('./i18n/babel-inline-plugin.js'), require.resolve('./i18n/catalogCompiler.js')]) {
            hash.update(require('fs').readFileSync(file));
        }
        return hash.digest('hex');
    };
    api.cache(() => `${env}:${platform}:${reactiveLocaleVersion()}:${catalogCompilerVersion()}`);
    const isProduction = env === 'production';
    const isTest = env === 'test';
    const isWeb = platform === 'web';
    // External resource inputs are immutable during one production export. The
    // complete digest is computed once here, never for every transformed file.
    const catalogRevision = isProduction && isWeb
        ? require('./i18n/babel-inline-plugin').getCatalogRevision(__dirname)
        : undefined;

    return {
        presets: [
            ['babel-preset-expo', {
                unstable_transformImportMeta: true
            }]
        ],
        plugins: [
            '@babel/plugin-transform-export-namespace-from',
            ['./i18n/babel-reactive-locale-plugin.js', { projectRoot: __dirname, platform, sourceRevision: reactiveLocaleVersion() }],
            isWeb && ['./i18n/babel-inline-plugin.js', {
                projectRoot: __dirname,
                precompileDeferredCatalogs: isProduction,
                catalogRevision,
                sourceRevision: catalogCompilerVersion(),
            }],
            // react-native-web переписывает импорты RN на web-реализацию — ТОЛЬКО для web,
            // в native-бандле это убивает рантайм (TurboModuleRegistry/EventEmitter = undefined)
            !isTest && isWeb && 'react-native-web',
            isTest && 'babel-plugin-dynamic-import-node',
            !isTest && ['module-resolver', {
                alias: {
                    '@': './',
                },
                extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
            }],
            isProduction && ['transform-remove-console', {
                exclude: ['error']
            }],
            // НЕ добавлять 'react-native-reanimated/plugin' вручную: babel-preset-expo (SDK 56)
            // сам подключает react-native-worklets/plugin; дубль ломает воркletизацию на native
            // ([Worklets] Tried to synchronously call a non-worklet function on the UI thread).
        ].filter(Boolean),
    };
};
