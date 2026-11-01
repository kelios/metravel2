import {runNodeCli} from '../../../scripts/cli-test-utils';

it('retains reused image-cache tiles in each viewport provenance and fails closed on an unavailable input',()=>{
 const result=runNodeCli(['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {questMapTileInputs} from './scripts/books/quest-maps.mjs';
  const cache=new Map();let reads=0;
  const load=async uri=>{if(!cache.has(uri)){reads++;cache.set(uri,{descriptor:{uri,bytes:256,sha256:'a'.repeat(64)}});}return cache.get(uri);};
  const first=await questMapTileInputs({zoom:15,startTX:10,endTX:11,startTY:20,endTY:20},load);
  const second=await questMapTileInputs({zoom:15,startTX:10,endTX:11,startTY:20,endTY:21},load);
  assert.equal(first.length,2);assert.equal(second.length,4);assert.equal(reads,4);
  for(const descriptor of first)assert.ok(second.includes(descriptor));
  assert.deepEqual(second.map(tile=>tile.uri),[
   'https://metravel.by/proxy/tiles/osm/15/10/20.png','https://metravel.by/proxy/tiles/osm/15/10/21.png',
   'https://metravel.by/proxy/tiles/osm/15/11/20.png','https://metravel.by/proxy/tiles/osm/15/11/21.png']);
  const reused=await questMapTileInputs({zoom:15,startTX:10,endTX:11,startTY:20,endTY:21},load);
  assert.deepEqual(reused,second);assert.equal(reads,4);
  await assert.rejects(()=>questMapTileInputs({zoom:15,startTX:10,endTX:11,startTY:20,endTY:21},async uri=>{
   if(uri.endsWith('/11/21.png'))throw new Error('Missing pinned tile');return load(uri);
  }),/Missing pinned tile/);
  console.log(JSON.stringify({firstTiles:2,expandedTiles:4,fullyReusedTiles:4,cacheMisses:reads,missingInputRejected:true}));
 `]);
 expect(result.status).toBe(0);
 expect(JSON.parse(result.stdout)).toEqual({firstTiles:2,expandedTiles:4,fullyReusedTiles:4,cacheMisses:4,missingInputRejected:true});
});
