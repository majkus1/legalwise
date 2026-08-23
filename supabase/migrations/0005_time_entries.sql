-- 0005 — Ewidencja czasu pracy (timesheet).
--
-- Czas trzymamy w minutach (integer), stawki i kwoty w groszach (bigint).
-- Stawka jest utrwalana w wierszu jako migawka: późniejsza zmiana cennika
-- nie może zmienić już zarejestrowanych ani zafakturowanych rozliczeń.

create table public.time_entries (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  case_id            uuid not null references public.cases (id) on delete restrict,
  user_id            uuid not null references auth.users (id) on delete restrict,
  work_date          date not null default current_date,
  minutes            integer not null,
  description        text not null,
  billing_type       public.billing_model not null,
  -- Migawka stawki godzinowej obowiązującej w chwili rejestracji wpisu.
  -- Dla ryczałtu i czynności nieodpłatnych wynosi 0.
  rate_snapshot_grosz bigint not null default 0,
  -- Czy wpis wchodzi do faktury. Czynności nieodpłatne nigdy nie wchodzą.
  billable           boolean not null default true,
  -- Ustawiane przy zatwierdzeniu faktury; blokuje edycję wpisu.
  locked_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint time_entries_minutes_positive check (minutes > 0 and minutes <= 1440),
  constraint time_entries_rate_nonnegative check (rate_snapshot_grosz >= 0),
  constraint time_entries_description_present check (length(trim(description)) > 0),
  -- Czynność nieodpłatna nie może być oznaczona jako podlegająca fakturowaniu.
  constraint time_entries_nonbillable_consistency
    check (billing_type <> 'nieodplatny' or billable = false)
);

create index time_entries_org_date_idx on public.time_entries (organization_id, work_date desc);
create index time_entries_user_date_idx on public.time_entries (user_id, work_date desc);
create index time_entries_case_idx on public.time_entries (case_id, work_date desc);
-- Wyszukiwanie wpisów gotowych do zafakturowania.
create index time_entries_unbilled_idx on public.time_entries (organization_id, case_id)
  where locked_at is null and billable;

create trigger time_entries_set_updated_at
  before update on public.time_entries for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rozstrzyganie warunków rozliczenia
--
-- Model rozliczenia: sprawa → klient.
-- Stawka godzinowa:  sprawa → klient → standardowa stawka prawnika.
--
-- Ten łańcuch obsługuje każdy wariant, jaki kancelaria może stosować, bez
-- konieczności zmiany schematu: stawki ustalane per sprawa, per klient
-- albo per prawnik.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_billing_model(p_case uuid)
returns public.billing_model
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(c.billing_model, cl.default_billing_model)
  from public.cases c
  join public.clients cl on cl.id = c.client_id
  where c.id = p_case
    and public.is_member_of(c.organization_id);
$$;

-- Wariant wewnętrzny: samo wyliczenie, bez kontroli uprawnień.
--
-- Używany przez trigger wypełniający wpis. Trigger nie jest miejscem na
-- autoryzację — o tym, czy wolno dodać wpis, rozstrzygnęła już polityka RLS
-- na time_entries. Gdyby trigger wołał wariant publiczny, zapis z kontekstu
-- serwisowego (migracje, zadania w tle, import danych) kończyłby się błędem,
-- bo auth.uid() jest tam puste.
--
-- Świadomie NIE nadajemy tu uprawnienia roli authenticated.
create or replace function public.resolve_hourly_rate_internal(p_case uuid, p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           c.hourly_rate_grosz,
           cl.default_hourly_rate_grosz,
           mr.default_hourly_rate_grosz,
           0
         )
  from public.cases c
  join public.clients cl on cl.id = c.client_id
  left join public.member_rates mr
    on mr.organization_id = c.organization_id and mr.user_id = p_user
  where c.id = p_case;
$$;

revoke all on function public.resolve_hourly_rate_internal(uuid, uuid) from public, anon, authenticated;

-- Wariant publiczny: to samo wyliczenie, ale z kontrolą uprawnień.
-- Służy podpowiadaniu stawki w interfejsie przed zapisaniem wpisu.
create or replace function public.resolve_hourly_rate(p_case uuid, p_user uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org
  from public.cases c
  where c.id = p_case;

  if v_org is null or not public.is_member_of(v_org) then
    raise exception 'Brak dostępu do sprawy' using errcode = '42501';
  end if;

  -- Cudzą stawkę może rozstrzygać wyłącznie osoba z wglądem w finanse.
  if p_user <> auth.uid() and not public.can_see_finances(v_org) then
    raise exception 'Brak uprawnień do stawek innych osób' using errcode = '42501';
  end if;

  return coalesce(public.resolve_hourly_rate_internal(p_case, p_user), 0);
end;
$$;

grant execute on function public.resolve_billing_model(uuid)      to authenticated;
grant execute on function public.resolve_hourly_rate(uuid, uuid)  to authenticated;

-- ---------------------------------------------------------------------------
-- Uzupełnianie wpisu przy zapisie
--
-- Model rozliczenia i migawka stawki są ustalane w bazie, a nie przez klienta.
-- Dzięki temu wpis dodany z pominięciem interfejsu również będzie policzony
-- poprawnie i nie da się podać dowolnej stawki z zewnątrz.
-- ---------------------------------------------------------------------------

create or replace function public.time_entries_apply_billing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_model public.billing_model;
begin
  select coalesce(c.billing_model, cl.default_billing_model)
    into v_model
  from public.cases c
  join public.clients cl on cl.id = c.client_id
  where c.id = new.case_id;

  if v_model is null then
    raise exception 'Nie udało się ustalić modelu rozliczenia dla sprawy' using errcode = '22023';
  end if;

  -- Model podany wprost ma pierwszeństwo (np. czynność pro bono w sprawie
  -- rozliczanej godzinowo), ale musi być świadomym wyborem, nie przypadkiem.
  new.billing_type := coalesce(new.billing_type, v_model);

  if new.billing_type = 'nieodplatny' then
    -- Czynności nieodpłatne nie wchodzą do faktury w ogóle, ale są ewidencjonowane
    -- i widoczne w zestawieniu dla klienta oraz w raportach rentowności.
    new.rate_snapshot_grosz := 0;
    new.billable := false;
  else
    -- Stawkę utrwalamy również przy ryczałcie. Sama kwota ryczałtu nie zależy
    -- od godzin, ale nadwyżka ponad limit godzin jest rozliczana godzinowo
    -- i musi korzystać ze stawki obowiązującej w chwili wykonania czynności,
    -- a nie z tej, która akurat obowiązuje przy wystawianiu faktury.
    new.rate_snapshot_grosz := coalesce(
      nullif(new.rate_snapshot_grosz, 0),
      public.resolve_hourly_rate_internal(new.case_id, new.user_id),
      0
    );
    new.billable := coalesce(new.billable, true);
  end if;

  return new;
end;
$$;

create trigger time_entries_apply_billing_on_insert
  before insert on public.time_entries
  for each row execute function public.time_entries_apply_billing();

-- ---------------------------------------------------------------------------
-- Ochrona wpisów zablokowanych
--
-- Wpis powiązany z zatwierdzoną fakturą jest zamknięty. Odblokowanie wymaga
-- cofnięcia zatwierdzenia faktury, co jest osobną operacją z wpisem do audytu.
-- ---------------------------------------------------------------------------

create or replace function public.time_entries_guard_locked()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.locked_at is not null then
      raise exception 'Wpis jest powiązany z zatwierdzoną fakturą i nie może zostać usunięty'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- Zdjęcie blokady jest dozwolone (robi to procedura cofająca zatwierdzenie
  -- faktury); zabroniona jest zmiana treści wpisu, dopóki blokada trwa.
  if old.locked_at is not null and new.locked_at is not null then
    if new.minutes          is distinct from old.minutes
       or new.work_date     is distinct from old.work_date
       or new.description   is distinct from old.description
       or new.billing_type  is distinct from old.billing_type
       or new.rate_snapshot_grosz is distinct from old.rate_snapshot_grosz
       or new.billable      is distinct from old.billable
       or new.case_id       is distinct from old.case_id
       or new.user_id       is distinct from old.user_id then
      raise exception 'Wpis jest zablokowany zatwierdzoną fakturą i nie może być edytowany'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger time_entries_guard_locked_on_update
  before update on public.time_entries
  for each row execute function public.time_entries_guard_locked();

create trigger time_entries_guard_locked_on_delete
  before delete on public.time_entries
  for each row execute function public.time_entries_guard_locked();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Prawnik widzi wyłącznie własne wpisy. Cudze godziny to informacja
-- o wydajności i podstawa rentowności — dostępna tylko owner i partner.
-- Sekretariat (staff) nie ma wglądu w ewidencję czasu.
-- ---------------------------------------------------------------------------

alter table public.time_entries enable row level security;
alter table public.time_entries force row level security;

create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    (user_id = auth.uid() and public.is_member_of(organization_id))
    or public.can_see_finances(organization_id)
  );

create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member_of(organization_id)
    and public.can_access_case(case_id)
  );

create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    (user_id = auth.uid() and public.is_member_of(organization_id))
    or public.can_see_finances(organization_id)
  )
  with check (
    (user_id = auth.uid() and public.is_member_of(organization_id))
    or public.can_see_finances(organization_id)
  );

create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (
    (user_id = auth.uid() and public.is_member_of(organization_id))
    or public.can_see_finances(organization_id)
  );

grant select, insert, update, delete on public.time_entries to authenticated;
