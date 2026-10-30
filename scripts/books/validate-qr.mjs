#!/usr/bin/env node
import {readFile,realpath,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

let indexPath,python=process.env.READY_BOOKS_QR_PYTHON||process.env.READY_BOOKS_PYTHON||'.codex-temp/books-production/venv/bin/python';
for(let i=2;i<process.argv.length;i++){
  if(process.argv[i]==='--python')python=process.argv[++i];
  else if(!indexPath)indexPath=process.argv[i];
  else throw new Error('Use production-index.json [--python PYTHON_WITH_ZXINGCPP]');
}
if(!indexPath||!python)throw new Error('Production index and QR interpreter are required');
const root=path.dirname(await realpath(indexPath));
if(!root.startsWith(path.resolve('.codex-temp')+path.sep))throw new Error('QR inspection must stay in ignored .codex-temp/');
const index=JSON.parse(await readFile(indexPath,'utf8'));
if(index.books?.length!==2)throw new Error('Both complete reading editions are required');
const reports=[];
for(const book of index.books)for(const group of book.profiles){
  const artifact=group.artifacts.find(item=>item.purpose==='read'&&item.component==='body');
  if(!artifact?.pageMapPath)throw new Error('Reading PDF and exact page map are required');
  for(const file of [artifact.path,artifact.pageMapPath,book.editorialPath])if(!(await realpath(file)).startsWith(root+path.sep))throw new Error('QR input escapes production package');
  const bytes=await readFile(artifact.path);
  if(createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)throw new Error('Reading PDF hash differs from index');
  const output=path.join(root,'validation','qr',book.bookId,group.profile.id);
  const result=spawnSync(python,['scripts/books/inspect-ready-qr.py','--pdf',artifact.path,'--book',book.editorialPath,'--page-map',artifact.pageMapPath,'--output',output],{encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
  if(result.error||result.status!==0)throw new Error('QR decoding failed: '+(result.error?.message||result.stderr));
  const report=JSON.parse(result.stdout);
  if(report.sha256!==artifact.sha256||report.stopCount!==book.stopCount)throw new Error('QR report differs from exact reading edition');
  reports.push({bookId:book.bookId,revision:book.revision,profileId:group.profile.id,...report});
  console.log(`${report.digitalPass?'PASS':'FAIL'} ${book.bookId}/${group.profile.id}: ${report.reports.length} color/grayscale exact-target QR checks`);
}
const report={schemaVersion:1,digitalPass:reports.length===4&&reports.every(item=>item.digitalPass),reports};
await mkdir(path.join(root,'validation'),{recursive:true});
await writeFile(path.join(root,'validation','qr-report.json'),JSON.stringify(report,null,2)+'\n');
if(!report.digitalPass)process.exitCode=1;
