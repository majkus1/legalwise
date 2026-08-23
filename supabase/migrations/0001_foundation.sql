-- 0001 — Fundament: rozszerzenia, typy wspólne i funkcje pomocnicze.
--
-- Zasady obowiązujące w całym schemacie:
--  * Kwoty pieniężne przechowujemy WYŁĄCZNIE w groszach jako bigint. Nigdy float.
--  * Czas pracy przechowujemy w minutach jako integer.
--  * Każda tabela operacyjna niesie organization_id i ma włączony RLS.
--  * Rekordów merytorycznych nie kasujemy twardo — archived_at / storno.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Automatyczne utrzymanie kolumny updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE ustawiający updated_at na now().';
