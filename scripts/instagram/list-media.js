// Выгрузка всей ленты @metravelby: id, дата, тип, первая строка подписи, ссылка. Токен не печатается.
const fs = require('fs')
const { gget, graphUrl, loadToken, discoverIgAccount } = require('../lib/instagramGraph')
;(async () => {
  const { token, igUserId } = loadToken()
  const igId = igUserId || (await discoverIgAccount(token)).igUserId
  let url = graphUrl(`${igId}/media`, { fields: 'id,caption,permalink,timestamp,media_product_type,media_type', limit: 100 }, token)
  const out = []
  while (url) {
    const page = await gget(url)
    for (const m of page.data || []) out.push({ id: m.id, ts: m.timestamp.slice(0, 10), kind: m.media_product_type || m.media_type, title: (m.caption || '').split('\n')[0].trim(), permalink: m.permalink })
    url = page.paging && page.paging.next ? page.paging.next : null
  }
  fs.writeFileSync('.codex-temp/instagram/published-media.json', JSON.stringify(out, null, 1))
  console.log(out.length, 'публикаций')
  for (const m of out) console.log(`${m.ts} ${m.kind.padEnd(6)} ${m.title.slice(0, 110)}`)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
