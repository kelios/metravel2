import type React from 'react';

let createElement:typeof import('react').createElement;
let renderToStaticMarkup:typeof import('react-dom/server').renderToStaticMarkup;
let NotFoundContent:React.ComponentType;
let translate:typeof import('@/i18n').translate;
jest.mock('expo-router',()=>({
  Stack:{Screen:()=>null},
  router:{replace:jest.fn()},
  Link:({children,href,...props}:any)=>require('react').createElement('a',{href,...props},children),
}));
jest.mock('@/components/seo/LazyInstantSEO',()=>({__esModule:true,default:()=>null}));
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label}:any)=>require('react').createElement('button',null,label)}));

beforeAll(()=>{
  jest.resetModules();
  jest.doMock('react-native',()=>jest.requireActual('react-native-web'));
  ({createElement}=require('react'));
  ({renderToStaticMarkup}=require('react-dom/server.node'));
  ({NotFoundContent}=require('@/components/screens/NotFoundContent'));
  ({translate}=require('@/i18n'));
});

it('includes a usable catalogue anchor in the shared404 before any effect or JavaScript',()=>{
  const host=document.createElement('div');
  host.innerHTML=renderToStaticMarkup(createElement(NotFoundContent));
  expect(host.querySelector('a[href="/books"]')?.textContent).toBe(translate('books:back'));
  expect(host.querySelectorAll('a[href="/books"]')).toHaveLength(1);
  expect(host.textContent).toContain(translate('shared:app.missing.na_glavnuyu_58d8ad67'));
});
