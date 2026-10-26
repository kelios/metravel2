// Web schedules no local notifications (services/notifications.web.ts), so
// there is nothing to cancel. A separate module keeps the notifications stub
// and the app-link parser out of the web quest catalog chunk (#2741).
export async function cancelQuestReturnReminder(_ownerId: string, _questId: string): Promise<void> {}
