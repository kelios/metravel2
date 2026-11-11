// #3231: разметка MobileApplication нужна только серверному HTML сайта;
// в приложении (и в тестовом рендерере RN) `<script>` не рисуется.
type AppDownloadJsonLdProps = { description: string; pageUrl: string }

export default function AppDownloadJsonLd(_props: AppDownloadJsonLdProps): null {
  return null
}
