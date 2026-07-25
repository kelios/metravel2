import { create } from 'zustand';

interface TravelSectionsState {
  /**
   * Latched intent: true между тапом по кнопке «Разделы» в шапке и моментом,
   * когда шит реально открылся. Именно латч, а не монотонный nonce: шит
   * монтируется поздно (post-LCP, `shouldShowTravelSectionsSheet`), а стор
   * глобальный и не сбрасывается между статьями — эффект свежего инстанса
   * видел старое `openNonce > 0` и открывал меню сам, сразу при открытии
   * следующей статьи. Латч потребляется один раз и переживает поздний mount,
   * поэтому тап «до появления шита» не теряется.
   */
  pendingOpen: boolean;
  /** Пользователь попросил открыть список разделов. */
  requestOpen: () => void;
  /** Снять запрос: шит открылся либо экран сменился и запрос протух. */
  consumeOpen: () => void;
}

export const useTravelSectionsStore = create<TravelSectionsState>((set) => ({
  pendingOpen: false,
  requestOpen: () => set({ pendingOpen: true }),
  consumeOpen: () => set((s) => (s.pendingOpen ? { pendingOpen: false } : s)),
}));
