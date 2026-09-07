const { chromium } = require('playwright');
const fs = require('fs');
const SP='/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/ea4cfe56-c241-448e-a584-830ed2711455/scratchpad';
const env = Object.fromEntries(fs.readFileSync('/Users/juliasavran/Sites/metravel2/metravel2/.env.e2e','utf8')
  .split(/\r?\n/).map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1});
 ctx.setDefaultNavigationTimeout(120000);
 const r=await ctx.request.post('https://metravel.by/api/user/login/',{data:{email:env.E2E_EMAIL2,password:env.E2E_PASSWORD2}});
 console.log('login',r.status());
 const me=await ctx.request.get('https://metravel.by/api/trips/planned/me/');
 console.log('me',me.status(),(await me.json()).length,'trips');
 const p=await ctx.newPage();
 const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
 await p.goto('https://metravel.by/trips/plan/47',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift'}));window.dispatchEvent(new WheelEvent('wheel',{deltaY:1}));});
 await p.waitForTimeout(9000);
 const txt=await p.evaluate(()=>document.body.innerText.slice(0,1200));
 console.log('--- PAGE TEXT ---\n'+txt);
 console.log('--- console errors:',errors.length); errors.slice(0,5).forEach(e=>console.log('  ',e));
 await p.screenshot({path:SP+'/trip47.png',fullPage:false});
 await b.close();
})();
