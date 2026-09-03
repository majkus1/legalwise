import { Skeleton } from "@/components/ui/skeleton";

/**
 * Szkielet ekranu na czas wczytywania.
 *
 * Bez niego kliknięcie w menu wyglądało jak brak reakcji: strona renderuje się
 * na serwerze, więc do chwili nadejścia gotowego HTML-a widać poprzedni ekran.
 * Przy szybkim łączu zmiana potrafiła umknąć uwadze, przy wolniejszym wyglądała
 * jak zawieszenie.
 *
 * Używany przez `loading.tsx` w KAŻDEJ trasie osobno. Jedna wspólna granica
 * w grupie `(app)` nie wystarcza: przy przejściu między siostrzanymi stronami
 * nie jest odmontowywana, więc się nie pokazuje — sprawdzone, wisiał wtedy
 * poprzedni ekran. Granica musi należeć do trasy, w którą wchodzimy.
 *
 * Panel boczny i górny pasek zostają na miejscu, bo pochodzą z układu nadrzędnego
 * — wymienia się wyłącznie obszar treści.
 *
 * Kształt odwzorowuje typowy ekran — nagłówek, rząd wskaźników, lista — żeby
 * układ nie przeskakiwał w chwili podmiany na prawdziwą treść.
 */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Wczytywanie…</span>

      {/* Nagłówek: tytuł, podpis i miejsce na przyciski akcji. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-36 sm:h-8" />
      </div>

      {/* Rząd wskaźników — na telefonie dwa w wierszu, tak jak w gotowym widoku. */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Lista. Wiersze mają malejącą szerokość, żeby blok nie wyglądał
          jak jednolita plama. */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-28" />
        </div>
        {[100, 92, 96, 88, 94, 90].map((szerokosc, index) => (
          <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4" style={{ width: `${szerokosc / 2}%` }} />
            <Skeleton className="ml-auto h-5 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
