// Будильник очереди доставки прогресса квеста (#1922).
//
// Компонент ничего не рисует: он существует, чтобы эффекты досылки жили выше
// экрана квеста и переживали уход с него. Рендерится в корневом layout рядом с
// NativeAppRuntime — отдельным узлом, а не хуком в самом layout: смена сети
// перерисовывала бы тогда всё дерево приложения.

import { useQuestProgressQueueRuntime } from '@/hooks/useQuestProgressQueueRuntime'

export default function QuestProgressQueueRuntime() {
  useQuestProgressQueueRuntime()
  return null
}
