// utils/printAvailability.native.ts
// #2102/#2119: печать в приложении — native-модуль expo-print. В сборках, где его
// нет, он не подгружается (его require бросает на старте), поэтому наличие
// проверяется опциональным запросом модуля, а не `Platform.OS`.
import { requireOptionalNativeModule } from 'expo'

const PRINT_NATIVE_MODULE = 'ExpoPrint'

export function isPrintAvailable(): boolean {
  try {
    return requireOptionalNativeModule(PRINT_NATIVE_MODULE) != null
  } catch {
    return false
  }
}
