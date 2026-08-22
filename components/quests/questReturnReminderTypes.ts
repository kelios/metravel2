// Общий контракт возвратного напоминания (#1484) для web/native реализаций.

export type QuestReturnReminderParams = {
  ownerId: string;
  questId?: string;
  cityId?: string;
  cityName?: string;
  questTitle: string;
  /** Прохождение засчитано — только тогда есть от чего звать обратно. */
  questCompleted: boolean;
  /** Сколько квестов города осталось непройденными. */
  remainingCount: number;
  /** Точное время нового финиша; null для финала из сохранённого прогресса. */
  completionFinishedAt: number | null;
};
