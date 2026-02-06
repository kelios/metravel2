// .babelrc.js
module.exports = function (api) {
    const env = api.env();
    api.cache(() => env);
    const isProduction = env === 'production';
    const isTest = env === 'test';

    return {
        presets: [
            ['babel-preset-expo', {
                unstable_transformImportMeta: true
            }]
        ],
        plugins: [
            '@babel/plugin-transform-export-namespace-from',
            !isTest && 'react-native-web',
            isTest && 'babel-plugin-dynamic-import-node',
            !isTest && ['module-resolver', {
                alias: {
                    '@': './',
                },
                extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
            }],
            isProduction && ['transform-remove-console', {
                exclude: ['error', 'warn', 'info']
            }],
            'react-native-reanimated/plugin',
        ].filter(Boolean),
    };
};