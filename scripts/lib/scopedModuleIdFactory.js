'use strict'

// Числовые id модулей Metro раздаются в порядке первого запроса. Expo
// экспортирует клиент и серверный render-бандл одновременно (`Promise.all` в
// @expo/cli exportStaticAsync), а штатная фабрика держит один счётчик на оба:
// id клиента зависели от того, чей сериализатор успел первым. С холодным
// кэшем первым был сервер, с тёплым — уже клиент, и один и тот же sha давал
// другие чанки (#2982). Свой счётчик у клиента каждой платформы делает его id
// функцией своего графа: клиент нумерует модули отсортированными путями
// (createGranularChunkingStrategy). Все серверные бандлы — render, loaders,
// middleware и любые другие окружения — по-прежнему делят один счётчик, как в
// штатной фабрике: они могут исполняться в одном рантайме с общим реестром
// модулей, и id там обязаны быть уникальны.
function createScopedNumericModuleIdFactory() {
  const scopes = new Map()
  return (modulePath, context) => {
    const environment = context?.environment ?? 'client'
    const scope = environment === 'client' ? `client\0${context?.platform ?? ''}` : 'server'
    let ids = scopes.get(scope)
    if (!ids) {
      ids = new Map()
      scopes.set(scope, ids)
    }
    let id = ids.get(modulePath)
    if (typeof id !== 'number') {
      id = ids.size
      ids.set(modulePath, id)
    }
    return id
  }
}

module.exports = { createScopedNumericModuleIdFactory }
