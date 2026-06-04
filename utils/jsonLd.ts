/**
 * Безопасная сериализация JSON-LD для встраивания в <script type="application/ld+json">.
 *
 * JSON.stringify НЕ экранирует `<`, `>`, `&`, поэтому строковое значение,
 * содержащее `</script>` (например, вредоносный URL обложки/галереи), пробивает
 * закрывающий тег скрипта -> stored XSS на SSR/гидратации. Экранируем эти символы
 * и разделители строк U+2028/U+2029 в \\uXXXX-форму — она валидна внутри JSON и
 * не интерпретируется парсером HTML как разметка.
 */
export function stringifyJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  )
}
