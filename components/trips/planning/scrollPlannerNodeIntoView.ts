// Прокрутка к узлу планировщика. Desktop-форма правки точки живёт ниже списка,
// а не внутри карточки, поэтому скролл вызывается на самой форме.

export type PlannerScrollOptions = {
  block: 'start' | 'nearest';
  behavior?: 'smooth';
};

export function scrollPlannerNodeIntoView(
  node: unknown,
  options: PlannerScrollOptions,
): void {
  const target = node as {
    scrollIntoView?: (opts: PlannerScrollOptions) => void;
  } | null;
  target?.scrollIntoView?.(options);
}
