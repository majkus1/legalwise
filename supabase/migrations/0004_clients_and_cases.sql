-- 0004 — Kartoteka klientów i spraw, strony postępowania, notatki, dokumenty.

create type public.client_type   as enum ('osoba_fizyczna', 'firma');
create type public.billing_model as enum ('godzinowy', 'ryczalt', 'nieodplatny');
create type public.case_type     as enum (
  'spor_sadowy', 'spor_pozasadowy', 'opinia', 'umowa', 'obsluga_korporacyjna', 'inna'
);
create type public.case_status   as enum ('aktywna', 'zawieszona', 'zakonczona');
create type public.party_role    as enum (
  'powod', 'pozwany', 'uczestnik', 'pelnomocnik_drugiej_strony', 'inny'
);
create type public.assignment_role as enum ('lead', 'member');

comment on type public.billing_model is
  'godzinowy  — stawka godzinowa
   ryczalt    — kwota stała za okres, opcjonalnie z limitem godzin
   nieodplatny — czynności nieodpłatne / pro bono (poza fakturą)';

-- ---------------------------------------------------------------------------
-- Klienci
-- ---------------------------------------------------------------------------

create table public.clients (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  name                      text not null,
  client_type               public.client_type not null default 'firma',
  tax_id                    text,                                  -- NIP
  address_line1             text,
  address_line2             text,
  postal_code               text,
  city                      text,
  country_code              text not null default 'PL',
  email                     citext,
  phone                     text,
  -- Adres, na który trafiają faktury i zestawienia godzin.
  billing_email             citext,
  -- Domyślne warunki rozliczeń; sprawa może je nadpisać.
  default_billing_model     public.billing_model not null default 'godzinowy',
  default_hourly_rate_grosz bigint,
  relationship_owner_id     uuid references auth.users (id) on delete set null,
  notes                     text,
  archived_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint clients_rate_nonnegative check (default_hourly_rate_grosz is null or default_hourly_rate_grosz >= 0)
);

create index clients_org_idx on public.clients (organization_id) where archived_at is null;
create index clients_org_name_idx on public.clients (organization_id, name);

-- ---------------------------------------------------------------------------
-- Sprawy
-- ---------------------------------------------------------------------------

create table public.cases (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  client_id                uuid not null references public.clients (id) on delete restrict,
  case_number              text not null,                       -- numer wewnętrzny kancelarii
  title                    text not null,
  case_type                public.case_type not null default 'spor_sadowy',
  status                   public.case_status not null default 'aktywna',
  -- Metryka sprawy sądowej
  signature                text,                                -- sygnatura akt, np. I C 1234/25
  court_name               text,                                -- sąd lub organ
  court_department         text,                                -- wydział
  lead_lawyer_id           uuid references auth.users (id) on delete set null,
  -- Warunki rozliczeń nadpisujące ustawienia klienta
  billing_model            public.billing_model,
  hourly_rate_grosz        bigint,
  flat_fee_grosz           bigint,
  flat_fee_included_minutes integer,
  description              text,
  opened_at                date not null default current_date,
  closed_at                date,
  archived_at              timestamptz,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint cases_number_unique unique (organization_id, case_number),
  constraint cases_rate_nonnegative check (hourly_rate_grosz is null or hourly_rate_grosz >= 0),
  constraint cases_flat_fee_nonnegative check (flat_fee_grosz is null or flat_fee_grosz >= 0),
  constraint cases_included_minutes_nonnegative
    check (flat_fee_included_minutes is null or flat_fee_included_minutes >= 0),
  constraint cases_closed_after_opened check (closed_at is null or closed_at >= opened_at)
);

create index cases_org_idx on public.cases (organization_id) where archived_at is null;
create index cases_client_idx on public.cases (client_id);
create index cases_lead_idx on public.cases (lead_lawyer_id) where archived_at is null;
create index cases_signature_idx on public.cases (organization_id, signature) where signature is not null;

-- Strony postępowania oraz pełnomocnik drugiej strony.
create table public.case_parties (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid not null references public.cases (id) on delete cascade,
  role            public.party_role not null,
  name            text not null,
  contact         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index case_parties_case_idx on public.case_parties (case_id);

-- Dostęp prawnika do sprawy. Zarówno lead, jak i member dają widoczność.
create table public.case_assignees (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid not null references public.cases (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  assignment_role public.assignment_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (case_id, user_id)
);

create index case_assignees_user_idx on public.case_assignees (user_id);

-- Notatki ze zdarzeń: ustalenia telefoniczne z sądem, rozmowy z klientem.
create table public.case_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid not null references public.cases (id) on delete cascade,
  author_id       uuid references auth.users (id) on delete set null,
  occurred_on     date not null default current_date,
  content         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index case_notes_case_idx on public.case_notes (case_id, occurred_on desc);

-- Repozytorium dokumentów. Pliki leżą w prywatnym buckecie Storage,
-- tutaj wyłącznie metadane i ścieżka.
create table public.case_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id         uuid not null references public.cases (id) on delete cascade,
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint case_documents_size_check check (size_bytes is null or size_bytes >= 0)
);

create index case_documents_case_idx on public.case_documents (case_id, created_at desc);

create trigger clients_set_updated_at
  before update on public.clients for each row execute function public.set_updated_at();
create trigger cases_set_updated_at
  before update on public.cases for each row execute function public.set_updated_at();
create trigger case_parties_set_updated_at
  before update on public.case_parties for each row execute function public.set_updated_at();
create trigger case_notes_set_updated_at
  before update on public.case_notes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reguła dostępu do sprawy
--
-- owner, partner, staff — widzą wszystkie sprawy kancelarii.
--   (staff prowadzi kalendarz i zadania, więc musi widzieć sprawy;
--    finanse są przed nim zamknięte osobnymi politykami.)
-- lawyer — wyłącznie sprawy prowadzone lub przypisane.
--
-- SECURITY DEFINER omija RLS, więc funkcja może czytać cases i case_assignees
-- bez wywoływania rekurencji polityk.
-- ---------------------------------------------------------------------------

create or replace function public.can_access_case(p_case uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = p_case
      and public.is_member_of(c.organization_id)
      and (
        public.has_role_in(c.organization_id, array['owner', 'partner', 'staff']::public.org_role[])
        or c.lead_lawyer_id = auth.uid()
        or exists (
          select 1 from public.case_assignees a
          where a.case_id = c.id and a.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_access_case(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clients        enable row level security;
alter table public.cases          enable row level security;
alter table public.case_parties   enable row level security;
alter table public.case_assignees enable row level security;
alter table public.case_notes     enable row level security;
alter table public.case_documents enable row level security;

alter table public.clients        force row level security;
alter table public.cases          force row level security;
alter table public.case_parties   force row level security;
alter table public.case_assignees force row level security;
alter table public.case_notes     force row level security;
alter table public.case_documents force row level security;

-- clients ------------------------------------------------------------------
create policy clients_select on public.clients
  for select to authenticated
  using (public.is_member_of(organization_id));

create policy clients_write on public.clients
  for all to authenticated
  using (public.has_role_in(organization_id, array['owner', 'partner', 'lawyer', 'staff']::public.org_role[]))
  with check (public.has_role_in(organization_id, array['owner', 'partner', 'lawyer', 'staff']::public.org_role[]));

-- cases --------------------------------------------------------------------
-- Warunek zduplikowany zamiast wywołania can_access_case(id), żeby planer
-- mógł użyć indeksów zamiast wywoływać funkcję dla każdego wiersza.
create policy cases_select on public.cases
  for select to authenticated
  using (
    public.is_member_of(organization_id)
    and (
      public.has_role_in(organization_id, array['owner', 'partner', 'staff']::public.org_role[])
      or lead_lawyer_id = auth.uid()
      or exists (
        select 1 from public.case_assignees a
        where a.case_id = public.cases.id and a.user_id = auth.uid()
      )
    )
  );

create policy cases_insert on public.cases
  for insert to authenticated
  with check (public.has_role_in(organization_id, array['owner', 'partner', 'lawyer', 'staff']::public.org_role[]));

create policy cases_update on public.cases
  for update to authenticated
  using (public.can_access_case(id))
  with check (public.can_access_case(id));

-- case_parties -------------------------------------------------------------
create policy case_parties_all on public.case_parties
  for all to authenticated
  using (public.can_access_case(case_id))
  with check (public.can_access_case(case_id));

-- case_assignees -----------------------------------------------------------
create policy case_assignees_select on public.case_assignees
  for select to authenticated
  using (public.can_access_case(case_id));

-- Skład zespołu przy sprawie zmieniają wyłącznie role zarządcze.
create policy case_assignees_write on public.case_assignees
  for all to authenticated
  using (public.has_role_in(organization_id, array['owner', 'partner']::public.org_role[]))
  with check (public.has_role_in(organization_id, array['owner', 'partner']::public.org_role[]));

-- case_notes ---------------------------------------------------------------
create policy case_notes_select on public.case_notes
  for select to authenticated
  using (public.can_access_case(case_id));

create policy case_notes_insert on public.case_notes
  for insert to authenticated
  with check (public.can_access_case(case_id) and author_id = auth.uid());

-- Notatkę edytuje i usuwa wyłącznie jej autor.
create policy case_notes_update on public.case_notes
  for update to authenticated
  using (author_id = auth.uid() and public.can_access_case(case_id))
  with check (author_id = auth.uid() and public.can_access_case(case_id));

create policy case_notes_delete on public.case_notes
  for delete to authenticated
  using (author_id = auth.uid() and public.can_access_case(case_id));

-- case_documents -----------------------------------------------------------
create policy case_documents_select on public.case_documents
  for select to authenticated
  using (public.can_access_case(case_id));

create policy case_documents_insert on public.case_documents
  for insert to authenticated
  with check (public.can_access_case(case_id) and uploaded_by = auth.uid());

create policy case_documents_delete on public.case_documents
  for delete to authenticated
  using (
    public.can_access_case(case_id)
    and (uploaded_by = auth.uid()
         or public.has_role_in(organization_id, array['owner', 'partner']::public.org_role[]))
  );

-- ---------------------------------------------------------------------------
-- Uprawnienia
-- ---------------------------------------------------------------------------

grant select, insert, update          on public.clients        to authenticated;
grant select, insert, update          on public.cases          to authenticated;
grant select, insert, update, delete  on public.case_parties   to authenticated;
grant select, insert, update, delete  on public.case_assignees to authenticated;
grant select, insert, update, delete  on public.case_notes     to authenticated;
grant select, insert, delete          on public.case_documents to authenticated;
