/** Следующая местная полночь, включая гражданские сутки длиной 23/25 часов. */
export function millisecondsUntilLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, next.getTime() - now.getTime());
}
