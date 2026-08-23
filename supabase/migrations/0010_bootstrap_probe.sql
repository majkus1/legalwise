-- 0010 — Sprawdzenie, czy kancelaria została już skonfigurowana.
--
-- Zalogowany użytkownik bez przyznanego dostępu nie widzi tabeli organizations
-- (RLS), więc nie odróżni sytuacji „kancelaria jeszcze nie istnieje” od
-- „istnieje, ale nie masz do niej dostępu”. Ekran po rejestracji musi te dwa
-- przypadki rozróżnić: w pierwszym proponuje konfigurację, w drugim informuje
-- o oczekiwaniu na nadanie dostępu.
--
-- Funkcja ujawnia wyłącznie jedną wartość logiczną — nie nazwę, nie liczbę,
-- nie żadne dane kancelarii.

create or replace function public.any_organization_exists()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.organizations);
$$;

grant execute on function public.any_organization_exists() to authenticated;
