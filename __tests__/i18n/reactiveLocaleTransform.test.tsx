import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { transformSync } from '@babel/core'
import i18n from '@/i18n/instance'
import { expectedLocaleOwners, expectedLocalPresentationMemos } from '../helpers/reactiveLocaleCoverage'

const plugin = require('../../i18n/babel-reactive-locale-plugin')
const projectRoot = path.resolve(__dirname, '../..')
const transform = (source: string, filename = 'components/LocaleFixture.tsx', execute = false) =>
  transformSync(source, {
    filename: path.join(projectRoot, filename), configFile: false, babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [
      [plugin, { projectRoot }],
      ...(execute ? [['@babel/plugin-transform-typescript', { isTSX: true }], ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }], '@babel/plugin-transform-modules-commonjs'] : []),
    ],
  })!

describe('locale compatibility transform (#2442)', () => {
  it.each([
    'export function Screen(){ if (false) return null; return <Text/> }',
    'export const Screen=()=> <Text/>',
    'export default function(){return <Text/>}',
    'export default React.memo(()=> <Text/>)',
    'export default memo(function(){ return <Text/> })',
    'export default forwardRef((props, ref)=> <Text ref={ref}/>)',
    'export function useLabels(){ return t("common:action.cancel") }',
  ])('subscribes exactly once at a proven owner before early returns: %s', source => {
    const output = transform(`import React, {memo,forwardRef} from 'react'; import {translate as t} from '@/i18n'; ${source}`).code!
    expect(output.match(/= _useLocaleRevision\(\)/g)).toHaveLength(1)
    const earlyReturn = output.indexOf('if (false)')
    if (earlyReturn >= 0) expect(output.indexOf('_useLocaleRevision()')).toBeLessThan(earlyReturn)
  })

  it('keeps helper/event/renderItem/worklet scopes hook free', () => {
    const output = transform(`
      import React,{useCallback} from 'react';import {translate as t} from '@/i18n';
      function label(){return t('common:action.cancel')}
      function Worklet(){'worklet';return t('common:action.cancel')}
      export function Screen(){ const renderItem=useCallback(()=> <Text>{label()}</Text>,[]);
        const onPress=()=>{t('common:action.cancel')}; return <Text/> }
    `).code!
    expect(output.match(/= _useLocaleRevision\(\)/g)).toHaveLength(1)
    expect(output).toContain('[_localeRevision]')
    expect(output).toMatch(/function Worklet\(\)\s*{\s*'worklet'/)
  })

  it('invalidates translation/getter/transitive-helper memos, preserving side-effect callback identity', () => {
    const output = transform(`
      import React,{useMemo,useCallback} from 'react';import {translate as t} from '@/i18n';
      import {formatRatingValue} from '@/utils/ratingHelpers';
      const options={get label(){return t('common:action.cancel')}};
      export function Screen({deps}) {
        const label=useMemo(()=>options.label,[...deps]);
        const rating=useMemo(()=>formatRatingValue(2),[]);
        const capture=useCallback(()=>label,[]);
        const directLabel=useCallback(()=>t('common:action.cancel'),[]);
        const formattedLabel=useCallback(()=>formatRatingValue(2),[]);
        const mutate=useCallback(async ()=>{await save();toast(t('common:action.cancel'))},[]);
        return <Text>{label}{rating}</Text>
      }
    `).code!
    expect(output).toMatch(/options.label, \[\.\.\.deps, _localeRevision\]/)
    expect(output).toMatch(/formatRatingValue\(2\), \[_localeRevision\]/)
    expect(output).toMatch(/\(\) => label, \[_localeRevision\]/)
    expect(output).toMatch(/\(\) => t\('common:action.cancel'\), \[_localeRevision\]/)
    expect(output).toMatch(/\(\) => formatRatingValue\(2\), \[_localeRevision\]/)
    expect(output).toMatch(/toast\(t\('common:action.cancel'\)\);\s*}, \[\]\)/)
  })

  it('preserves every-render missing/undefined dependencies and all effect dependencies', () => {
    const output = transform(`import React,{useMemo,useEffect} from 'react';import {translate as t} from '@/i18n';
      export function Screen(){useEffect(()=>toast(t('common:action.cancel')),[]);
      const a=useMemo(()=>t('common:action.cancel')); const b=useMemo(()=>t('common:action.cancel'),undefined);
      const c=useMemo(()=>t('common:action.cancel'),void 0); return <Text/>}`).code!
    expect(output).toContain("t('common:action.cancel'), undefined)")
    expect(output).toContain("t('common:action.cancel'), void 0)")
    expect(output).toMatch(/useEffect\(\(\) => toast\(t\('common:action.cancel'\)\), \[\]\)/)
  })

  it('refreshes named imported and local presentation factories while leaving data factories stable', () => {
    const output = transform(`import React,{useMemo,useCallback} from 'react';
      import {translate as t} from '@/i18n';
      import {getPopupTooltips} from '@/components/MapPage/Map/PlacePopupCard/constants';
      import {getInterestingCategoryCollections} from '@/screens/tabs/PlacesScreen.helpers';
      import {formatDistanceMeters} from '@/utils/distanceCalculator';
      function label(){return t('common:action.cancel')}
      const alias=label; function data(){return [1,2]}
      export function Screen(){const a=useMemo(getPopupTooltips,[]);const b=useMemo(getInterestingCategoryCollections,[]);
        const c=useMemo(alias,[]);const d=useCallback(label,[]);const e=useMemo(data,[]);
        const f=useMemo(()=>formatDistanceMeters(100),[]);return <Text/>}` ).code!
    expect(output).toContain('useMemo(getPopupTooltips, [_localeRevision])')
    expect(output).toContain('useMemo(getInterestingCategoryCollections, [_localeRevision])')
    expect(output).toContain('useMemo(alias, [_localeRevision])')
    expect(output).toContain('useCallback(label, [_localeRevision])')
    expect(output).toContain('useMemo(data, [])')
    expect(output).toContain('formatDistanceMeters(100), [_localeRevision]')
  })

  it('fails an unsupported sensitive dependency shape rather than silently leaving stale UI', () => {
    expect(() => transform(`import React,{useMemo} from 'react';import {translate as t} from '@/i18n';
      export function Screen({deps}){const a=useMemo(()=>t('common:action.cancel'),deps);return <Text/>}`))
      .toThrow('explicit dependency array')
  })

  it('refreshes arrow-wrapped local return factories and accumulated validation, preserving actions/deferred callbacks', () => {
    const source = `import React,{useMemo,useCallback} from 'react';import {translate as t} from '@/i18n';
      function getLabels(){return [{label:t('common:action.cancel')}]}
      const arrow=()=>getLabels();
      function validate(){const errors=[];errors.push(t('common:action.cancel'));return errors}
      function raw(){const event=()=>t('common:action.cancel');return [1,2]}
      const deferred=()=>t('common:action.cancel');function getHandler(){return deferred}
      async function load(){try{return await fetch()}catch{throw new Error(t('common:action.cancel'))}}
      function useData(){return {label:t('common:action.cancel')}}
      export function Screen({onError}){const a=useMemo(()=>getLabels(),[]);const b=useMemo(()=>arrow(),[]);
        const errors=useMemo(()=>validate(),[]);const c=useMemo(()=>raw(),[]);const handler=useMemo(()=>getHandler(),[]);
        const data=useMemo(()=>useData(),[]);const fetcher=useCallback(()=>load(),[]);
        const action=useCallback(()=>onError(t('common:action.cancel')),[]);return <Text/>}`
    const output = transform(source).code!
    expect(output).toMatch(/getLabels\(\), \[_localeRevision\d*\]/)
    expect(output).toMatch(/arrow\(\), \[_localeRevision\d*\]/)
    expect(output).toMatch(/validate\(\), \[_localeRevision\d*\]/)
    for (const name of ['raw', 'getHandler', 'useData', 'load']) expect(output).toContain(`${name}(), []`)
    expect(output).toContain("onError(t('common:action.cancel')), []")
    const inventory = expectedLocalPresentationMemos('components/Fixture.tsx', source)
    expect(inventory).toHaveLength(3)
  })

  it('refreshes computed local getter values while preserving lazy table identities and style property keys', () => {
    const source = `import React,{useMemo} from 'react';import {translate as t} from '@/i18n';
      const groups={get primary(){return t('common:action.cancel')}};
      export function Screen({key}){const label=t('common:action.cancel');
        const table=useMemo(()=>groups,[]);const value=useMemo(()=>groups[key],[]);
        const styles=useMemo(()=>({label:{color:'red'}}),[]);return <Text>{label}{value}</Text>}`
    const output = transform(source).code!
    expect(output).toContain('() => groups, []')
    expect(output).toContain('() => groups[key], [_localeRevision]')
    expect(expectedLocalPresentationMemos('components/Fixture.tsx', source)).toHaveLength(1)
  })

  it.each(['file', 'directory'])('resolves imported %s helpers by the actual bundle platform', layout => {
    const temporary = fs.mkdtempSync(path.join(projectRoot, '.codex-temp/locale-transform-platform-'))
    fs.mkdirSync(path.join(temporary, 'utils'))
    fs.mkdirSync(path.join(temporary, 'components'))
    const helper = layout === 'directory' ? 'utils/helper/index' : 'utils/helper'
    if (layout === 'directory') fs.mkdirSync(path.join(temporary, 'utils/helper'))
    fs.writeFileSync(path.join(temporary, `${helper}.web.ts`), 'export const label=()=> "API content"')
    fs.writeFileSync(path.join(temporary, `${helper}.native.ts`), "import {translate} from '@/i18n';export const label=()=>translate('common:action.cancel')")
    const source = "import React,{useMemo} from 'react';import {label} from '@/utils/helper';export function Screen(){const text=useMemo(()=>label(),[]);return <Text>{text}</Text>}"
    try {
      for (const platform of ['web', 'ios', 'android']) {
        const result = transformSync(source, { filename: path.join(temporary, 'components/Screen.tsx'), configFile: false, babelrc: false,
          parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [[plugin, { projectRoot: temporary, platform }]],
        })!.code!
        expect(result.includes('label(), [_localeRevision]')).toBe(platform !== 'web')
      }
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); plugin.resetLocaleModuleCache() }
  })

  it('keeps imported label getters and transitive non-React helpers reactive', () => {
    const temporary = fs.mkdtempSync(path.join(projectRoot, '.codex-temp/locale-transform-helpers-'))
    fs.mkdirSync(path.join(temporary, 'components'))
    fs.writeFileSync(path.join(temporary, 'components/base.ts'), "import {translate} from '@/i18n';export const labels={get label(){return translate('common:action.cancel')}};export const base=()=>translate('common:action.cancel')")
    fs.writeFileSync(path.join(temporary, 'components/helper.ts'), "import {base} from './base';export const label=()=>base()")
    fs.writeFileSync(path.join(temporary, 'components/barrel.ts'), "export * from './helper'")
    const source = "import React,{useMemo} from 'react';import {label} from './barrel';import {labels} from './base';export function Screen(){const a=useMemo(()=>label(),[]);const b=useMemo(()=>labels.label,[]);return <Text>{a}{b}</Text>}"
    try {
      const output = transformSync(source, { filename: path.join(temporary, 'components/Screen.tsx'), configFile: false, babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [[plugin, { projectRoot: temporary }]],
      })!.code!
      expect(output).toContain('label(), [_localeRevision]')
      expect(output).toContain('labels.label, [_localeRevision]')
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); plugin.resetLocaleModuleCache() }
  })

  it('invalidates transitive helper analysis when source changes in the same compiler process', () => {
    const temporary = fs.mkdtempSync(path.join(projectRoot, '.codex-temp/locale-transform-cache-'))
    fs.mkdirSync(path.join(temporary, 'components'))
    const helper = path.join(temporary, 'components/base.ts')
    fs.writeFileSync(helper, 'export const label=()=> "API content"')
    fs.writeFileSync(path.join(temporary, 'components/barrel.ts'), "export {label} from './base'")
    const source = "import React,{useMemo} from 'react';import {label} from './barrel';export function Screen(){const text=useMemo(label,[]);return <Text>{text}</Text>}"
    const compile = () => transformSync(source, { filename: path.join(temporary, 'components/Screen.tsx'), configFile: false, babelrc: false,
      parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [[plugin, { projectRoot: temporary }]],
    })!.code!
    try {
      expect(compile()).toContain('useMemo(label, [])')
      fs.writeFileSync(helper, "import {translate} from '@/i18n';export const label=()=>translate('common:action.cancel')")
      expect(compile()).toContain('useMemo(label, [_localeRevision])')
      fs.writeFileSync(helper, 'export const label=()=> "API content again"')
      expect(compile()).toContain('useMemo(label, [])')
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); plugin.resetLocaleModuleCache() }
  })

  it('does not invalidate query data, mutation callbacks or callback-local error translations', () => {
    const output = transform(`import React,{useMemo,useCallback} from 'react';import {translate as t} from '@/i18n';
      import {useFavorites} from '@/hooks/useFavorites';
      export function Screen(){const {addFavorite,items}=useFavorites();
        const data=useMemo(()=>items.filter(item=>item.id),[items]);
        const action=useCallback(()=>addFavorite(data),[addFavorite,data]);
        const network=useCallback(async()=>{try{await fetch()}catch{const error=t('common:action.cancel');throw new Error(error)}},[]);
        return <Text/>}` ).code!
    expect(output).toContain('items.filter(item => item.id), [items])')
    expect(output).toContain('addFavorite(data), [addFavorite, data])')
    expect(output).not.toMatch(/\}, \[_localeRevision\]\)/)
  })

  it('requires a locale wrapper for React classes and never inserts hooks into the class', () => {
    expect(() => transform(`import React from 'react';import {translate as t} from '@/i18n';
      export class Boundary extends React.Component {render(){return <Text>{t('common:action.cancel')}</Text>}}`))
      .toThrow('state-preserving localeRevision wrapper')
    const output = transform(`import React from 'react';import {translate as t} from '@/i18n';
      import {useLocaleRevision} from '@/i18n/useLocaleRevision';
      class Boundary extends React.Component {render(){return <Text>{t('common:action.cancel')}</Text>}}
      export default React.forwardRef(function Wrapper(props,ref){const localeRevision=useLocaleRevision();return <Boundary {...props} ref={ref} localeRevision={localeRevision}/>})`).code!
    expect(output.match(/= useLocaleRevision\(\)/g)).toHaveLength(1)
    expect(output).not.toContain('= _useLocaleRevision()')
  })

  it.each(['node_modules/vendor/Screen.tsx', 'i18n/runtime.tsx', '__tests__/Fixture.tsx'])('excludes runtime/vendor/test module %s', filename => {
    expect(transform(`import React from 'react';export function Screen(){return <Text/>}`, filename).metadata.localeReactiveOwners).toBeUndefined()
  })

  it('updates a real transformed memo screen and render callback without destroying ID/form or repeating startup work', async () => {
    const code = transform(`
      import React,{useState,useMemo,useCallback,useEffect} from 'react';
      import {Text} from 'react-native'; import {translate as t} from '@/i18n';
      import {getPopupTooltips} from '@/components/MapPage/Map/PlacePopupCard/constants';
      export const Screen=React.memo(function Screen({capture,startup}) {
        const [id,setId]=useState(null);const [draft,setDraft]=useState('');
        useEffect(()=>{startup()},[]);
        const label=useMemo(()=>t('common:action.cancel'),[]);
        const tooltips=useMemo(getPopupTooltips,[]);
        const renderLabel=useCallback(()=> <Text>{label}</Text>,[]);
        capture(()=>{setId(6);setDraft('my route')});
        return <Text>{id}:{draft}:{renderLabel()}<Text>{tooltips.copyCoords}</Text></Text>;
      });
    `, 'components/LocaleFixture.tsx', true).code!
    const exports: { Screen?: React.ComponentType<{ capture: (edit: () => void) => void; startup: () => void }> } = {}
    new Function('require', 'exports', code)(require, exports)
    const startup = jest.fn()
    let edit!: () => void
    await act(async () => { await i18n.changeLanguage('en') })
    const Fixture = exports.Screen!
    render(<Fixture capture={callback => { edit = callback }} startup={startup} />)
    await act(async () => edit())
    expect(screen.getByText('Cancel')).toBeTruthy()
    for (const [locale, label] of [['pl', 'Anuluj'], ['ru', 'Отмена'], ['en', 'Cancel']] as const) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(screen.getByText(label)).toBeTruthy()
      const { getPopupTooltips } = require('@/components/MapPage/Map/PlacePopupCard/constants') as typeof import('@/components/MapPage/Map/PlacePopupCard/constants')
      expect(screen.getByText(getPopupTooltips().copyCoords)).toBeTruthy()
      expect(screen.getByText(/6:my route:/)).toBeTruthy()
    }
    expect(startup).toHaveBeenCalledTimes(1)
    await act(async () => { await i18n.changeLanguage('ru') })
  })

  it('covers the actual app-owned source without unsupported hook patterns', () => {
    const files = execFileSync('rg', ['--files', ...plugin.ROOTS], { cwd: projectRoot, encoding: 'utf8' })
      .trim().split('\n').filter(file => /\.[jt]sx?$/.test(file) && !file.endsWith('.d.ts'))
    const failures: string[] = []
    const localMemoInventory: Array<{ file: string; line: number; kind: string }> = []
    let owners = 0
    for (const file of files) {
      try {
        const source = fs.readFileSync(path.join(projectRoot, file), 'utf8')
        const result = transform(source, file)
        const actual = result.metadata.localeReactiveOwners as Array<{ name: string; line: number }> | undefined
        const expected = expectedLocaleOwners(file, source)
        for (const owner of expected) if (!actual?.some(found => found.line === owner.line)) failures.push(`${file}:${owner.line}: uncovered React owner ${owner.name}`)
        owners += (result.metadata.localeReactiveOwners as unknown[] | undefined)?.length ?? 0
        const presentation = result.metadata.localeReactivePresentationHooks as Array<{ line: number; kind: string }> | undefined
        for (const memo of expectedLocalPresentationMemos(file, source, expected)) {
          localMemoInventory.push({ file, ...memo })
          if (!presentation?.some(actualMemo => actualMemo.line === memo.line && actualMemo.kind === memo.kind)) failures.push(`${file}:${memo.line}: uncovered local presentation ${memo.kind}`)
        }
      } catch (error) { failures.push(`${file}: ${String(error)}`) }
    }
    expect(failures).toEqual([])
    expect(owners).toBeGreaterThan(650)
    const reportDirectory = path.join(projectRoot, '.codex-temp')
    fs.mkdirSync(reportDirectory, { recursive: true })
    fs.writeFileSync(path.join(reportDirectory, 'locale-reactive-memo-coverage.json'), JSON.stringify({ files: files.length, owners, localMemos: localMemoInventory, failures }, null, 2))
  }, 60000)
})
