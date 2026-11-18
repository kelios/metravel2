## Механизм и решение
Source main8ba3ed27a: JS lock и installed @expo/log-box58.0.14 согласованы, tracked iOS lock58.0.13 отстал. `pod install --deployment` exit1 независимо подтверждает version/checksum conflict. Установить58.0.13 только в node_modules нельзя: это нарушает frozen JS lock. Выбран штатный `pod install` без обновления package/yarn.

## Scope, риск и откат
Единственный native source path: ios/Podfile.lock; OpenSpec artifacts сопровождают task3453. Сохранить hashes всех tracked ios/package/yarn, проверить весь generated diff. Ожидаются ExpoLogBox58.0.13→58.0.14 и соответствующий checksum; любые изменения project settings/source сначала разбирать отдельно. Откат — revert явных task paths без чужих файлов.
Data/API contract: none; backend read-only. Platform impact: iOS. Localization impact: none.

## Validation selection gate
Changed contract → воспроизводимая установка того же frozen native set → `pod install --deployment`, hash comparison, Manifest.lock equality, ios:release:guard, OpenSpec strict. Unit/i18n/web/Android не повторять: нет JS/UI/data изменений. Для приёмки #3453 после review/push/testing — одна unsigned iOS simulator build и native-build-stamp; старый бинарник не может заменить текущий. Для #3452 затем сохраняются его native footer/keyboard assertions. Любая новая версия/lock/config меняет native set и инвалидирует stamp/build evidence.

## Handoff
Не менять stamp старого приложения задним числом. Успешную новую simulator build штатно stamp, проверить установленный артефакт, записать SHA/target. Никаких signed/store операций.
