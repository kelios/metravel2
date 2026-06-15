// components/quests/useQuestReminder.web.ts
// Web has no local notifications — no-op.

type QuestReminderParams = {
  questId?: string;
  cityId?: string;
  title: string;
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
};

export function useQuestReminder(_params: QuestReminderParams): void {
  // no-op on web
}
