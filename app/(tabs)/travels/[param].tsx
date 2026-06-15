import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'
import TravelDetailsBackButton from '@/components/travel/details/TravelDetailsBackButton'

export default function TravelDetailsScreen() {
  // Android: hardware Back должен возвращать на предыдущий экран (карта/список),
  // а не сбрасывать Tab-навигатор на главную. useAndroidBackHandler сам гейтит
  // по Platform.OS === 'android' и зовёт router.back() при canGoBack().
  useAndroidBackHandler()
  return (
    <>
      <TravelDetailsContainer />
      {/* Видимая кнопка «Назад» — native-only (на web .tsx-стаб = null).
          Особенно нужна на iOS, где нет аппаратного Back. */}
      <TravelDetailsBackButton />
    </>
  )
}
