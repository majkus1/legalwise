-- 0011 — Automatyczna numeracja spraw.
--
-- Numer sprawy w formacie RRRR/NNN (np. 2026/014), z licznikiem odrębnym dla
-- każdego roku. Ten sam wzorzec współbieżności co przy numeracji faktur
-- w migracji 0007: dwie osoby zakładające sprawę w tej samej sekundzie nie mogą
-- otrzymać tego samego numeru.

create table public.case_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null,
  next_number     integer not null default 1,
  primary key (organization_id, year),
  constraint case_sequences_positive check (next_number >= 1)
);

alter table public.case_sequences enable row level security;
alter table public.case_sequences force row level security;
-- Brak polityk i brak uprawnień dla roli authenticated: licznikiem zarządza
-- wyłącznie funkcja poniżej, działająca jako SECURITY DEFINER.

create or replace function public.next_case_number(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year   integer := extract(year from current_date)::integer;
  v_number integer;
begin
  -- Kontrola dotyczy wywołań z sesją użytkownika. Kontekst serwisowy
  -- (migracje, seed, zadania w tle) ma auth.uid() puste i nie przechodziłby
  -- tego sprawdzenia, choć i tak omija RLS.
  if auth.uid() is not null and not public.is_member_of(p_org) then
    raise exception 'Brak dostępu do kancelarii' using errcode = '42501';
  end if;

  -- Upsert jest atomowy: przy konflikcie Postgres blokuje wiersz. W obu
  -- gałęziach poprawnym wynikiem jest next_number - 1, bo kolumna trzyma
  -- zawsze NASTĘPNY wolny numer.
  insert into public.case_sequences as s (organization_id, year, next_number)
  values (p_org, v_year, 2)
  on conflict (organization_id, year)
    do update set next_number = s.next_number + 1
  returning s.next_number - 1 into v_number;

  return v_year::text || '/' || lpad(v_number::text, 3, '0');
end;
$$;

grant execute on function public.next_case_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Wyrównanie licznika do danych już istniejących
--
-- Dane demonstracyjne i dane wprowadzone ręcznie mają numery nadane z palca.
-- Bez tego pierwsza sprawa założona przez aplikację dostałaby numer 2026/001,
-- który już istnieje, i naruszyłaby ograniczenie unikalności.
-- ---------------------------------------------------------------------------

-- Rok bierzemy z samego numeru sprawy, a nie z daty otwarcia — sprawa założona
-- w styczniu może nosić numer z poprzedniego roku i odwrotnie.
insert into public.case_sequences (organization_id, year, next_number)
select
  c.organization_id,
  split_part(c.case_number, '/', 1)::integer as year,
  max(split_part(c.case_number, '/', 2)::integer) + 1
from public.cases c
where c.case_number ~ '^\d{4}/\d+$'
group by c.organization_id, split_part(c.case_number, '/', 1)
on conflict (organization_id, year) do nothing;
