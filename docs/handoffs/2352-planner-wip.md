# #2352: сохранённый незавершённый планировщик PDF

Дата: 2026-10-10. Архив разработки, не действующий контракт.
Пользователь поручил закоммитить, запушить сделанное и остановиться.

Рабочая реализация checkpoint/index была опубликована общим frontend-коммитом
`2c0ea5d6c16601737f7e6669147bffd8e25ffb99`. Продолжение сохранено в соседнем
`2352-planner-wip.patch`: 34 путей, 273375 байт,
SHA-256 `314fbdd2b04b162b2ae313f1bce220637a81b8d08d680ffba220ecd0a3d2ce8f`. Патч основан на указанном commit;
**не применён к рабочим исходникам и не принят для production**.

## Что сохранено

Private planning protocol2: index/body/TOC/frontmatter/descriptors; immutable
checkpoint/generation ledger; committed-only index/parser receipt lookup;
bounded parser transaction; absolute folio and source occurrence verification;
lazy job-scoped physical session; atomic fsynced print resource publication;
regression tests и черновое описание контракта.

## Состояние проверок

Эта staged реализация не запускалась: общий frontend release держал source freeze
и quality gate. Unit, typecheck, lint, independent code review, artifact/runtime
и production acceptance именно этого патча **не выполнены**. Проверки ранее
опубликованного index-only кода не заменяют эти проверки. Capability/readiness
и статусы done не включены. Backend и UI продолжения не реализованы.

## Возобновление

После нового поручения владельца проверить main/status и живых исполнителей.
На чистом согласованном снимке проверить применение патча, сохранить чужой diff,
применить его и выполнить targeted suites, tsc, lint/guards и требуемый полный
code-level gate. Независимый review-auditor + code-review-gate обязательны;
следовать commit/push/testing/deploy/acceptance pipeline. Не снимать legacy caps
до завершения B3/F2/F3 и реальной полной PDF-приёмки.

Открытые архитектурные проверки: filesystem/resource closure независимо от
control-ledger; bounded commit-authority IPC/index и отрицательные lookup;
долговечность/восстановление backend membership; стоимость односимвольных
transitions и fsync, bounded batching; RSS/browser recycling/cgroup budgets.
Session reuse не доказывает capacity. Нужно завершить #2354, затем #2356/#2357/
#2358; родитель #2352 остаётся незавершённым.

## Точный staged снимок

SHA в таблице относятся к конечным файлам после применения, не к diff hunks.

| Путь | SHA-256 | Байты |
| --- | --- | ---: |
| `docs/book-renderer-contract.md` | `ff0095676474e25924392177df4e96b4004c7f2e266bf71927ef3e731eeff5df` | 39006 |
| `services/pdf-export/segments/subdivideSource.ts` | `4089eeed9ab7011b90b0b4748b04b2fd6e986df55f82e65e44d3f71746e59f65` | 1062 |
| `services/pdf-export/segments/subdivisionChildren.ts` | `6acc9d2e5993a321dfff4cff171b9a7b2e801774531a765936e879c88cd3127f` | 6056 |
| `workers/book-renderer/htmlCheckpoint/Parser.ts` | `95aec1ae689758eeb7c11a17b02e1722e1d2e19c04ed896a8218c7a4d0483902` | 26315 |
| `workers/book-renderer/htmlCheckpoint/diskStores.ts` | `ed58e88514865ac7ee4b37f4e3b87f4a3c346cfb0ba2d1d1b925372470514f8a` | 6541 |
| `workers/book-renderer/immutableFile.ts` | `c4acfdd4f786aaa4614bd165d3fb052ebdbab17a30cb1f0f4c85061e01d6b644` | 5302 |
| `workers/book-renderer/index.ts` | `46139d6af6f81c6a0f871908468cd2cbd28cae7434c8c99be986395cd1c9353a` | 11538 |
| `workers/book-renderer/planningBody.ts` | `f7d4318f6313cdad5de53830760d4ef97325120a844029dfb6d9d53cdf43990c` | 20477 |
| `workers/book-renderer/planningBookTypes.ts` | `d2333613f5affb3208a76f1b88812dc6431c7604d7fd8d262a7a98efa2dc3603` | 17073 |
| `workers/book-renderer/planningContent.ts` | `8c1b5ec75474d9ffa35613b45912ddbdbfabb0ac5395fad9944e75e9657a83c4` | 13657 |
| `workers/book-renderer/planningDescriptors.ts` | `4642d1ca7775bbd0206535cc887c2454dc1cbdff2a14e769ef328073328d37ba` | 11162 |
| `workers/book-renderer/planningFrontmatter.ts` | `a7da76431ecaceee71c833fecac3d1fdeee53d14fe2be0b5aa7a1dbe32ee85bd` | 12078 |
| `workers/book-renderer/planningLedger.ts` | `f1c82b8b0db51d249df1c48d22ef2ec1d9afa69eb2a88713563f4ac89cea1720` | 3485 |
| `workers/book-renderer/planningPageQueue.ts` | `9eb34020f9a894014aec47d6f048678d3cac38fd29ed1d16481eb2e880392130` | 21351 |
| `workers/book-renderer/planningPorts.ts` | `1a68a37936c9ee2f696c3b8a08af421afd3111ffdfd497b71c964e408ddedafb` | 3673 |
| `workers/book-renderer/planningSession.ts` | `9286c70b3b828a4f4c4f8789123c275a8e4d13332a567efd5f62eb87f81911b2` | 2322 |
| `workers/book-renderer/planningStep.ts` | `70e2dca045f3f5f01d6523797b6e7d9609b98c551cc9b81b8019480b5f9faa35` | 15272 |
| `workers/book-renderer/planningStorage.ts` | `8d48352f73ac9b9a96aee9cd3b852b53c22c6c05f396a499ec1f0d136424fdd5` | 7334 |
| `workers/book-renderer/planningTypes.ts` | `41a73ee30211a1c434d09310b2e914b9e2f023a4463c5296835169541b4fe849` | 2423 |
| `workers/book-renderer/printAssets.ts` | `fc76efaac7fe4fa29352c77509692419c5803a2172df7ac91aa19c611938227c` | 35519 |
| `__tests__/services/pdf-export/incrementalContentCheckpoint.test.ts` | `4ff5f514e36cf2d4889a1441c083b46fb23a383c62a5e4e608d329aa04950f93` | 21729 |
| `__tests__/workers/book-renderer/artifact.test.ts` | `51382fc170fd0bf19f08acbabf5805b04ce215f9e7b72ca6e817ab8397984305` | 14104 |
| `__tests__/workers/book-renderer/bookPlanningResume.test.ts` | `3c8afc52a6b96675c58b31693e405c46f693f37df7e02f4aad5d03352ab5fd57` | 17331 |
| `__tests__/workers/book-renderer/htmlCheckpointReadReceipts.test.ts` | `29e00235fca230ce2f135c6df584552e2536d8f22f5d37ac055a20cf2664e2fc` | 6059 |
| `__tests__/workers/book-renderer/immutableFile.test.ts` | `67653a54b72b75cf42422bc2855395b3c6e33494eab87ab3b1ea1df7a5e924ed` | 8606 |
| `__tests__/workers/book-renderer/planningDescriptors.test.ts` | `dbadb6391a3cfa21f74390c6f6defdd86a831a8af5b9dda229f42a3fe5d14ea6` | 8748 |
| `__tests__/workers/book-renderer/planningIndex.test.ts` | `ee5ee55430e7bf8ce072208fa8829e992440612e763ee9e07f6d269af5cacfb9` | 10446 |
| `__tests__/workers/book-renderer/planningLedger.test.ts` | `1c2595d60534f695e1faa568bc03a2c1fb8644566d03d9a73964126c1886d019` | 4382 |
| `__tests__/workers/book-renderer/planningPageQueue.test.ts` | `ff80fdbea5fde7ba85d6156c1f91ac5a4bf0c2bcda7513a7ac0fafcda1c4fc4c` | 20594 |
| `__tests__/workers/book-renderer/planningPorts.test.ts` | `b9bb4fe6bc98af84f7c2cf4a4a9567528145df3b01fd3bfcf538957e9e4e28af` | 8409 |
| `__tests__/workers/book-renderer/planningSession.test.ts` | `b3ba1777099cf26e31814a84f2ad1075a971b0bd4410a9dc8fea8ce3291252c7` | 7102 |
| `__tests__/workers/book-renderer/planningStep.test.ts` | `641fa7b7fbe95871574b1fc0d12c9fc40a8eca39e194dadeccedf192f1a18d4a` | 10090 |
| `__tests__/workers/book-renderer/planningStorage.test.ts` | `8c5dd45d0818029848a9d89206208f3902ab121d53ec9649482686811d296214` | 5506 |
| `__tests__/workers/book-renderer/printAssets.test.ts` | `5d11ecad05064b1479457589da390d58af0ba5d6d0cc1b7f3fa4e5d8b52ebe83` | 31470 |
