import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

export default function TravelDetailsScreen() {
  // Android: hardware Back должен возвращать на предыдущий экран (карта/список),
  // а не сбрасывать Tab-навигатор на главную. useAndroidBackHandler сам гейтит
  // по Platform.OS === 'android' и зовёт router.back() при canGoBack().
  useAndroidBackHandler()
  return <TravelDetailsContainer />
}
