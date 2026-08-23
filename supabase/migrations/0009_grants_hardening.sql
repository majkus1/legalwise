-- 0009 — Uporządkowanie uprawnień na poziomie ról bazodanowych.
--
-- RLS decyduje, KTÓRE WIERSZE widzi użytkownik. Uprawnienia GRANT decydują,
-- czy w ogóle wolno mu dotknąć tabeli. To dwie różne warstwy i obie muszą być
-- ustawione świadomie.
--
-- Domyślne uprawnienia Supabase nadają rolom `anon` i `authenticated` prawa
-- TRUNCATE i TRIGGER na nowo tworzonych tabelach w schemacie public. Aplikacja
-- ich nie potrzebuje, a TRUNCATE nie podlega RLS — wystarczyłaby jedna funkcja
-- SECURITY INVOKER, żeby stały się drogą do wyczyszczenia tabeli. Odbieramy je.

-- ---------------------------------------------------------------------------
-- service_role — klucz serwisowy, używany wyłącznie po stronie serwera
--
-- Rola ma atrybut BYPASSRLS, więc i tak nie podlega politykom; brak uprawnień
-- DML nie dawał tu żadnego bezpieczeństwa, a jedynie blokował operacje
-- administracyjne i przygotowanie danych w testach.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- ---------------------------------------------------------------------------
-- anon — użytkownik niezalogowany
--
-- W tej aplikacji nie ma danych publicznych. Rola anon obsługuje wyłącznie
-- ekrany logowania i rejestracji, które operują na schemacie auth, a nie na
-- danych kancelarii. Odbieramy jej wszystko w schemacie public.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- authenticated — zalogowany użytkownik
--
-- Uprawnienia DML nadają poszczególne migracje, tabela po tabeli, świadomie.
-- Tutaj odbieramy tylko to, czego aplikacja nigdy nie potrzebuje.
-- ---------------------------------------------------------------------------

revoke truncate on all tables in schema public from authenticated;
revoke trigger on all tables in schema public from authenticated;
revoke references on all tables in schema public from authenticated;

alter default privileges in schema public
  revoke truncate, trigger, references on tables from authenticated;
