import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MeTravelHooks from './hooks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const input = { tool: 'metravel_task_board_metravel_task_update', sessionID: 'test-session', callID: 'call-1', args: { task_id: 123, status: 'review' } };
const cmd = file => `node "\${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/${file}"`;
const entry = (matcher, file) => ({ matcher, hooks: [{ type: 'command', command: cmd(file) }] });
const matcher = 'mcp__metravel-task-board__metravel_task_update';
const settings = { hooks: {
 PreToolUse: ['task-quality-gate.mjs','review-gate.mjs','task-claim.mjs'].map(file => entry(matcher,file)),
 PostToolUse: ['review-gate.mjs','task-claim.mjs','board-compact.mjs'].map(file => entry(matcher,file)),
} };
const bridge = runHook => MeTravelHooks({directory: root},{runHook,loadSettings: async()=>settings});

test('maps exact OpenCode alias and canonical prefixes, ignores unrelated tools', async () => {
 const seen=[];const hooks=await bridge(async(file,payload)=>{seen.push(payload.tool_name);return []});
 await hooks['tool.execute.before'](input,{args:input.args});
 assert.equal(seen[0],matcher);
 seen.length=0;
 await hooks['tool.execute.before']({...input,tool:'mcp__metravel_task_board__metravel_task_update'},{args:input.args});
 assert.equal(seen[0],matcher);
 seen.length=0;await hooks['tool.execute.before']({...input,tool:'bash'},{args:{}});assert.equal(seen.length,0);
});
test('denial encoded in successful JSON prevents a tool execution', async () => {
 let executed = false;
 const hooks=await bridge(async()=>[{hookSpecificOutput:{permissionDecision:'deny',permissionDecisionReason:'Missing Task Contract'}}]);
 await assert.rejects(async()=> { await hooks['tool.execute.before'](input,{args:input.args}); executed=true; },/Missing Task Contract/);
 assert.equal(executed,false);
});
test('child failure, unavailable verification and missing hooks block writes', async () => {
 for(const run of [async()=>{throw Error('child failed')},async()=>[{systemMessage:'контракт описания НЕ проверен'}]]) {
  await assert.rejects((await bridge(run))['tool.execute.before'](input,{args:input.args}));
 }
 const hooks=await MeTravelHooks({directory:root},{loadSettings:async()=>({hooks:{}}),runHook:async()=>[]});
 await assert.rejects(hooks['tool.execute.before'](input,{args:input.args}),/missing/);
});
test('post hooks get original MCP response before compaction and preserve image blocks/context', async () => {
 const seen=[];
 const raw={content:[{type:'text',text:'{"id":123,"status":"review"}'},{type:'image',data:'abc',mimeType:'image/png'}],isError:false};
 const original=structuredClone(raw);
 const hooks=await bridge(async(file,payload,cwd)=>{
  assert.equal(cwd,root);assert.equal(payload.tool_name,matcher);assert.equal(payload.session_id,'test-session');
  if(payload.hook_event_name==='PreToolUse')return [{systemMessage:'pre evidence'}];
  seen.push(file);assert.deepEqual(payload.tool_response,original);
  return file==='board-compact.mjs'?[{hookSpecificOutput:{updatedToolOutput:'#123 review'}}]:[{hookSpecificOutput:{additionalContext:`next:${file}`}}];
 });
 await hooks['tool.execute.before'](input,{args:input.args}); await hooks['tool.execute.after'](input,raw);
 assert.deepEqual(seen,['review-gate.mjs','task-claim.mjs','board-compact.mjs']);
 assert.match(raw.content[0].text,/#123 review/);assert.match(raw.content[0].text,/next:review-gate/);assert.match(raw.content[0].text,/pre evidence/);
 assert.deepEqual(raw.content[1],original.content[1]);assert.equal(raw.isError,false);
});
test('ordinary tools untouched; normal output shape supported', async()=>{
 const hooks=await bridge(async()=>[{hookSpecificOutput:{additionalContext:'review next'}}]);
 const normal={title:'board',output:'raw',metadata:{keep:true}};
 await hooks['tool.execute.after'](input,normal);assert.match(normal.output,/review next/);assert.deepEqual(normal.metadata,{keep:true});
 const other={args:{command:'pwd'}};await hooks['tool.execute.before']({...input,tool:'bash'},other);assert.deepEqual(other,{args:{command:'pwd'}});
});
test('actual canonical quality gate denies missing contract without API/mutation', async()=>{
 const actualRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const payload={hook_event_name:'PreToolUse',tool_name:'mcp__metravel-task-board__metravel_task_create',
  tool_input:{title:'Invalid test-only draft',area:'front',description:'Missing contract'},session_id:'unit-test',cwd:actualRoot};
 const hooks=await MeTravelHooks({directory:actualRoot});
 await assert.rejects(hooks['tool.execute.before']({tool:payload.tool_name,sessionID:'unit-test',callID:'negative-test'},{args:payload.tool_input}),/контракт|Гейт качества/);
});

test('post-hook failure preserves the successful MCP receipt and warns against blind retry', async () => {
 const hooks=await bridge(async(file,payload)=>{
  if(payload.hook_event_name==='PostToolUse')throw new Error('post hook failed');
  return [];
 });
 const raw={content:[{type:'text',text:'{"id":123,"status":"review"}'}],isError:false};
 const receipt=structuredClone(raw.content[0]);
 await hooks['tool.execute.before'](input,{args:input.args});
 await assert.doesNotReject(hooks['tool.execute.after'](input,raw));
 assert.deepEqual(raw.content[0],receipt);assert.equal(raw.isError,false);
 assert.match(raw.content[1].text,/Операция могла уже успешно выполниться/);
 assert.match(raw.content[1].text,/metravel_task_get/);
 assert.match(raw.content[1].text,/не повторяйте запись вслепую/);
 assert.match(raw.content[1].text,/post-гейты не подтверждены/);
});

test('canonical fail-open post diagnostic also requires reconciliation without losing receipt', async () => {
 const hooks=await bridge(async(file,payload)=>payload.hook_event_name==='PostToolUse'
  ?[{systemMessage:'task-claim: хук упал (unavailable); занятость карточки НЕ проверена'}]:[]);
 const raw={content:[{type:'text',text:'{"id":123,"status":"review"}'}]};
 await hooks['tool.execute.after'](input,raw);
 assert.equal(raw.content[0].text,'{"id":123,"status":"review"}');
 assert.match(raw.content[1].text,/metravel_task_get/);
 assert.match(raw.content[1].text,/post-гейты не подтверждены/);
});
