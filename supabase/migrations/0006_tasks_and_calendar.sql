-- 0006 — Zadania (To-Do wraz z rejestrem braków formalnych) i wspólny kalendarz.

create type public.task_status   as enum ('do_zrobienia', 'w_toku', 'zrobione', 'anulowane');
create type public.task_priority as enum ('niski', 'normalny', 'wysoki', 'pilny');
create type public.task_kind     as enum ('zadanie', 'brak_formalny');
create type public.event_kind    as enum (
  'rozprawa', 'posiedzenie', 'termin_procesowy', 'spotkanie', 'inne'
);
-- Zaczep pod Portal Informacyjny Sądów Powszechnych. Zdarzenia wprowadzone
-- ręcznie i zaciągnięte automatycznie muszą być rozróżnialne, żeby import
-- nie nadpisywał ustaleń wprowadzonych przez kancelarię.
create type public.event_source  as enum ('manual', 'pi_import');

comment on type public.task_kind is
  'zadanie      — zwykłe zadanie z terminem
   brak_formalny — brak do uzupełnienia, zwykle z terminem ustawowym;
                   wyróżniany w interfejsie jako osobny rejestr';

-- ---------------------------------------------------------------------------
-- Zadania
-- ---------------------------------------------------------------------------

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Zadanie może nie dotyczyć konkretnej sprawy (np. czynność organizacyjna).
  case_id         uuid references public.cases (id) on delete cascade,
  title           text not null,
  description     text,
  task_kind       public.task_kind not null default 'zadanie',
  status          public.task_status not null default 'do_zrobienia',
  priority        public.task_priority not null default 'normalny',
  assignee_id     uuid references auth.users (id) on delete set null,
  due_date        date,
  completed_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tasks_title_present check (length(trim(title)) > 0),
  -- Brak formalny bez terminu jest bezużyteczny — termin jest tu istotą rzeczy.
  constraint tasks_deficiency_needs_due_date
    check (task_kind <> 'brak_formalny' or due_date is not null)
);

create index tasks_org_status_idx on public.tasks (organization_id, status, due_date);
create index tasks_assignee_idx on public.tasks (assignee_id, status, due_date);
create index tasks_case_idx on public.tasks (case_id, status);
create index tasks_deficiencies_idx on public.tasks (organization_id, due_date)
  where task_kind = 'brak_formalny' and status <> 'zrobione';

-- ---------------------------------------------------------------------------
-- Kalendarz
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete cascade,
  -- Powiązanie z zadaniem pozwala uniknąć powielania tego samego terminu
  -- w liście zadań i w kalendarzu.
  task_id         uuid references public.tasks (id) on delete set null,
  title           text not null,
  event_kind      public.event_kind not null default 'rozprawa',
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  all_day         boolean not null default false,
  location        text,                      -- sąd, sala, adres
  description     text,
  source          public.event_source not null default 'manual',
  -- Identyfikator zdarzenia w systemie źródłowym (Portal Informacyjny).
  external_ref    text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint calendar_events_title_present check (length(trim(title)) > 0),
  constraint calendar_events_ends_after_starts check (ends_at is null or ends_at >= starts_at)
);

create index calendar_events_org_start_idx on public.calendar_events (organization_id, starts_at);
create index calendar_events_case_idx on public.calendar_events (case_id, starts_at);
-- Import z Portalu Informacyjnego musi być idempotentny: to samo zdarzenie
-- pobrane dwa razy nie może utworzyć duplikatu.
create unique index calendar_events_external_ref_unique
  on public.calendar_events (organization_id, external_ref)
  where external_ref is not null;

create trigger tasks_set_updated_at
  before update on public.tasks for each row execute function public.set_updated_at();
create trigger calendar_events_set_updated_at
  before update on public.calendar_events for each row execute function public.set_updated_at();

-- Znacznik zakończenia utrzymywany automatycznie, żeby raporty nie zależały
-- od tego, czy interfejs pamiętał go ustawić.
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'zrobione' and coalesce(old.status, 'do_zrobienia') <> 'zrobione' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'zrobione' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at_trg
  before insert or update on public.tasks
  for each row execute function public.tasks_sync_completed_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Zadania i zdarzenia powiązane ze sprawą dziedziczą jej dostęp; pozycje bez
-- sprawy są widoczne dla całej kancelarii.
--
-- DECYZJA DO POTWIERDZENIA Z KLIENTEM: prawnik widzi kalendarz wyłącznie
-- w zakresie spraw, które prowadzi lub do których jest przypisany. Owner,
-- partner i sekretariat widzą wszystko, więc wspólny kalendarz kancelarii
-- działa. Gdyby kancelaria chciała, aby każdy prawnik widział wszystkie
-- terminy, wystarczy dopisać 'lawyer' do listy ról w can_access_case (0004).
-- ---------------------------------------------------------------------------

alter table public.tasks           enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tasks           force row level security;
alter table public.calendar_events force row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  );

create policy tasks_write on public.tasks
  for all to authenticated
  using (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  )
  with check (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  );

create policy calendar_events_select on public.calendar_events
  for select to authenticated
  using (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  );

create policy calendar_events_write on public.calendar_events
  for all to authenticated
  using (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  )
  with check (
    public.is_member_of(organization_id)
    and (case_id is null or public.can_access_case(case_id))
  );

grant select, insert, update, delete on public.tasks           to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
