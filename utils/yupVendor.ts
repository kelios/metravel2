// Single named async root for Yup. Import this module only through import();
// direct package imports create anonymous `index-*` chunks that collide in the
// bundle-budget grouping and can be hoisted when another route imports Yup.
export * from 'yup'
