// #2360: quill 2 imports only cloneDeep / isEqual / merge from the `lodash-es`
// barrel. Metro does not tree-shake, so the barrel put the whole library
// (~146 KB raw, 640 modules) into the editor chunk. These per-method modules
// are the same implementations the barrel re-exports; metro.config.js routes
// only quill's own `lodash-es` imports here, and
// __tests__/scripts/quill-lodash-es-stub.test.ts fails if quill starts to need
// a name this file does not export.
export { default as cloneDeep } from 'lodash-es/cloneDeep.js'
export { default as isEqual } from 'lodash-es/isEqual.js'
export { default as merge } from 'lodash-es/merge.js'
