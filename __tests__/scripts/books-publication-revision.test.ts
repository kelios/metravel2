import {runNodeCli} from './cli-test-utils';

it('versions every input that can change immutable PDF, control or preview bytes',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import {publicationRevision} from './scripts/books/publish.mjs';
    const source={revision:'r1',profiles:[{profile:{id:'pocket-150x100'},artifacts:[{purpose:'read',component:'body',sha256:'pdf'}],controls:[{sha256:'control'}]}]};
    const inputs={editorial:{title:'book'},publisherHash:'publisher',rasterizerVersion:'poppler',encoderVersions:{webp:'1'}};
    const base=publicationRevision(source,inputs);
    const changedControl=structuredClone(source);changedControl.profiles[0].controls[0].sha256='other';
    const changedControlPlan=structuredClone(source);Object.assign(changedControlPlan.profiles[0].controls[0],{controlFor:'home-rings',component:'cover'});
    console.log(JSON.stringify({base,repeat:publicationRevision(source,inputs),changed:[
      publicationRevision(changedControl,inputs),
      publicationRevision(changedControlPlan,inputs),
      publicationRevision(source,{...inputs,publisherHash:'new-publisher'}),
      publicationRevision(source,{...inputs,rasterizerVersion:'new-poppler'}),
      publicationRevision(source,{...inputs,encoderVersions:{webp:'2'}}),
      publicationRevision(source,{...inputs,editorial:{title:'new-book'}}),
    ]}));
  `],{},{cwd:process.cwd(),timeoutMs:10000});
  expect(result.status).toBe(0);
  const {base,repeat,changed}=JSON.parse(result.stdout);
  expect(repeat).toBe(base);
  expect(new Set([base,...changed]).size).toBe(7);
});

it('versions cover templates, the full font, its license, presets and physical text layout',()=>{
  const result=runNodeCli(['--input-type=module','-e',`
    import {publicationRevision} from './scripts/books/publish.mjs';
    const source={revision:'r1',profiles:[],coverPersonalization:{schemaVersion:1,maxCharacters:120,defaultPresetId:'home-memories',presets:[{id:'home-memories',text:'Approved'}],font:{bytes:10,sha256:'font',mime:'font/ttf',license:{bytes:5,sha256:'license',mime:'text/plain'}},templates:[{profileId:'album-a5',mode:'read',bytes:100,sha256:'template',mime:'application/pdf',pageCount:4,widthMm:148,heightMm:210,textRegion:{xMm:15}}]}};
    const options={editorial:{},publisherHash:'p',rasterizerVersion:'r',encoderVersions:{}};
    const base=publicationRevision(source,options),changed=[];
    for(const mutate of [s=>s.coverPersonalization.font.sha256='other',s=>s.coverPersonalization.font.license.sha256='other',s=>s.coverPersonalization.templates[0].sha256='other',s=>s.coverPersonalization.templates[0].textRegion.xMm=16,s=>s.coverPersonalization.presets[0].text='Other']){const next=structuredClone(source);mutate(next);changed.push(publicationRevision(next,options));}
    console.log(JSON.stringify({base,changed}));
  `],{},{cwd:process.cwd(),timeoutMs:10000});
  expect(result.status).toBe(0);const {base,changed}=JSON.parse(result.stdout);expect(new Set([base,...changed]).size).toBe(6);
});
