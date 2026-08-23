"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export interface FeedbackState {
  message?: string;
  error?: string;
}

/**
 * Pokazuje komunikat po zakończeniu akcji serwerowej i uruchamia reakcję.
 *
 * Dlaczego hook, a nie zwykłe `if (state.message) toast(...)` w ciele
 * komponentu: ciało renderu wykonuje się przy KAŻDYM renderze, więc komunikat
 * pojawiałby się wielokrotnie, a domknięcie okna czy wyczyszczenie formularza
 * potrafiło zadziałać w środku pisania. Referencja pilnuje, żeby ten sam
 * komunikat obsłużyć dokładnie raz.
 *
 * Wywoływanie setState w efekcie jest tu świadome: zamknięcie okna to reakcja
 * na zdarzenie zewnętrzne (odpowiedź serwera), a useActionState nie udostępnia
 * własnego wywołania zwrotnego po zakończeniu akcji.
 */
export function useActionFeedback(
  state: FeedbackState,
  handlers: { onSuccess?: () => void; onError?: () => void } = {},
): void {
  const handledMessage = useRef<string | undefined>(undefined);
  const handledError = useRef<string | undefined>(undefined);
  const latestHandlers = useRef(handlers);

  useEffect(() => {
    // Zapis do referencji należy do efektu, nie do ciała renderu — render musi
    // być wolny od skutków ubocznych, żeby React mógł go bezpiecznie powtórzyć.
    latestHandlers.current = handlers;
  });

  useEffect(() => {
    if (state.message && state.message !== handledMessage.current) {
      handledMessage.current = state.message;
      toast.success(state.message);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reakcja na odpowiedź serwera; useActionState nie ma wywołania zwrotnego
      latestHandlers.current.onSuccess?.();
    }

    if (state.error && state.error !== handledError.current) {
      handledError.current = state.error;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- j.w.
      latestHandlers.current.onError?.();
    }
  }, [state]);
}
