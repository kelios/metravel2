#!/usr/bin/env node
/**
 * Меняет ТОЛЬКО поле `order` у шагов живого квеста (двухфазно, без коллизий unique).
 * step_id не трогает — прогресс игроков переживает реордер.
 *
 * node scripts/reorder-quest-steps-prod.js --quest-id=<qid> --order=<step_id,step_id,...> [--dry-run]
 */
const { createToolSession, publicRequest, TokenError, formatTokenError } = require('./lib/metravel-tool-session');

const args=process.argv.slice(2);
const dry=args.includes('--dry-run');
const qid=(args.find(a=>a.startsWith('--quest-id='))||'').split('=')[1];
const orderArg=(args.find(a=>a.startsWith('--order='))||'').split('=').slice(1).join('=');
const API=(args.find(a=>a.startsWith('--api-url='))||'').split('=')[1]||'https://metravel.by';
if(!qid||!orderArg){console.error('need --quest-id and --order');process.exit(1);}
const want=orderArg.split(',').map(s=>s.trim()).filter(Boolean);

const SESSION=createToolSession({ origin: API });
async function get(e) { const r = await (dry ? publicRequest(API, API+e) : SESSION.request(e)); if(!r.ok) throw new TokenError('response', {status:r.status}); return r.json(); }
async function patch(e,b) { if(dry){console.log('[DRY] PATCH',e,JSON.stringify(b));return{};} const r=await SESSION.request(e,{method:'PATCH',json:b}); if(!r.ok)throw new TokenError('response',{status:r.status});return r.json(); }
(async()=>{
 const d=await get(`/api/quests/by-quest-id/${encodeURIComponent(qid)}/`);
 const steps=(d.steps||[]).filter(s=>!s.is_intro);
 const byId=new Map(steps.map(s=>[s.step_id,s]));
 const missing=want.filter(i=>!byId.has(i));
 const extra=steps.map(s=>s.step_id).filter(i=>!want.includes(i));
 if(missing.length||extra.length){console.error('MISMATCH missing:',missing,'extra:',extra);process.exit(1);}
 for(let i=0;i<want.length;i++) await patch(`/api/quest-steps/${byId.get(want[i]).id}/`,{order:900+i});
 for(let i=0;i<want.length;i++) await patch(`/api/quest-steps/${byId.get(want[i]).id}/`,{order:i+1});
 console.log(`✅ ${qid}: ${want.join(' -> ')}`);
})().catch(e=>{console.error('Fatal:',formatTokenError(e));process.exit(1);});
