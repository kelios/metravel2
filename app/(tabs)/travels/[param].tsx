import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

export default function TravelDetailsScreen() {
  // Android: hardware Back должен возвращать на предыдущий экран (карта/список),
  // а не сбрасывать Tab-навигатор на главную. useAndroidBackHandler сам гейтит
  // по Platform.OS === 'android' и зовёт router.back() при canGoBack().
  // Видимая кнопка «Назад» на этом экране даётся HeaderContextBar (mobile-ветка:
  // ← + заголовок + секции) на всех платформах, включая iOS, поэтому отдельная
  // floating-кнопка поверх hero-слайдера не нужна — она дублировала back и налезала
  // на счётчик кадров слайдера.
  useAndroidBackHandler()
  return <TravelDetailsContainer />
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return shellRouteMetadata()
}
