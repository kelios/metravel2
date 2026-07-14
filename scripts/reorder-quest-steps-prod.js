#!/usr/bin/env node
/**
 * Меняет ТОЛЬКО поле `order` у шагов живого квеста (двухфазно, без коллизий unique).
 * step_id не трогает — прогресс игроков переживает реордер.
 *
 * node scripts/reorder-quest-steps-prod.js --quest-id=<qid> --order=<step_id,step_id,...> [--dry-run]
 */
const fs=require('fs'),os=require('os'),path=require('path');
const args=process.argv.slice(2);
const dry=args.includes('--dry-run');
const qid=(args.find(a=>a.startsWith('--quest-id='))||'').split('=')[1];
const orderArg=(args.find(a=>a.startsWith('--order='))||'').split('=').slice(1).join('=');
const API=(args.find(a=>a.startsWith('--api-url='))||'').split('=')[1]||'https://metravel.by';
if(!qid||!orderArg){console.error('need --quest-id and --order');process.exit(1);}
const want=orderArg.split(',').map(s=>s.trim()).filter(Boolean);
function token(){const t=process.env.METRAVEL_TOKEN;if(t)return t;const p=path.join(os.homedir(),'.metravel_token');return fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():null;}
const TOKEN=token();
async function get(e){const r=await fetch(API+e,{headers:TOKEN?{Authorization:`Token ${TOKEN}`}:{}});if(!r.ok)throw new Error(`GET ${e} ${r.status}`);return r.json();}
async function patch(e,b){if(dry){console.log('[DRY] PATCH',e,JSON.stringify(b));return{};}
 const r=await fetch(API+e,{method:'PATCH',headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:`Token ${TOKEN}`}:{})},body:JSON.stringify(b)});
 if(!r.ok)throw new Error(`PATCH ${e} ${r.status}: ${await r.text()}`);return r.json();}
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
})().catch(e=>{console.error('Fatal:',e.message);process.exit(1);});
