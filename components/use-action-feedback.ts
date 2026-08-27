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
  // Pilnujemy OBIEKTU stanu, a nie treści komunikatu. `useActionState` zwraca
  // przy każdym wywołaniu nowy obiekt, więc dwa zapisy tego samego formularza
  // dają dwa różne wyniki o identycznej treści — porównywanie tekstu zjadałoby
  // drugie potwierdzenie i wyglądało, jakby zapis nie doszedł.
  const handledState = useRef<FeedbackState | null>(null);
  const latestHandlers = useRef(handlers);

  useEffect(() => {
    // Zapis do referencji należy do efektu, nie do ciała renderu — render musi
    // być wolny od skutków ubocznych, żeby React mógł go bezpiecznie powtórzyć.
    latestHandlers.current = handlers;
  });

  useEffect(() => {
    // Ten sam obiekt trafia tu ponownie przy podwójnym uruchomieniu efektów
    // w trybie ścisłym — obsługujemy go dokładnie raz.
    if (state === handledState.current) return;
    handledState.current = state;

    if (state.message) {
      toast.success(state.message);
      latestHandlers.current.onSuccess?.();
    }

    if (state.error) {
      latestHandlers.current.onError?.();
    }
  }, [state]);
}
