// .babelrc.js
module.exports = function (api) {
    const env = api.env();
    // Metro передаёт платформу через caller; web-only трансформы нельзя применять к native-бандлу
    const platform = api.caller((caller) => caller?.platform);
    api.cache(() => `${env}:${platform}`);
    const isProduction = env === 'production';
    const isTest = env === 'test';
    const isWeb = platform === 'web';

    return {
        presets: [
            ['babel-preset-expo', {
                unstable_transformImportMeta: true
            }]
        ],
        plugins: [
            '@babel/plugin-transform-export-namespace-from',
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