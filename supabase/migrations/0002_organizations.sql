-- 0002 — Organizacja (kancelaria), członkostwo, role i katalog użytkowników.
--
-- UWAGA NA REKURENCJĘ RLS.
-- Polityki na organization_members NIE MOGĄ odpytywać organization_members
-- zwykłym zapytaniem — spowodowałoby to nieskończoną rekurencję. Cały dostęp
-- do informacji o członkostwie idzie przez funkcje SECURITY DEFINER zdefiniowane
-- niżej, które omijają RLS. Nie cofać tego wzorca.

create type public.org_role as enum ('owner', 'partner', 'lawyer', 'staff');

comment on type public.org_role is
  'owner  — właściciel: wszystko + zespół + dane kancelarii + rentowność całego zespołu
   partner — pełny wgląd w sprawy i finanse
   lawyer  — sprawy własne i przypisane, własny timesheet, wyłącznie własna rentowność
   staff   — sekretariat: kalendarz, zadania, kartoteka; bez finansów';

-- ---------------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------------

create table public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  legal_name             text,
  tax_id                 text,                    -- NIP
  address_line1          text,
  address_line2          text,
  postal_code            text,
  city                   text,
  country_code           text not null default 'PL',
  bank_account           text,
  email                  citext,
  phone                  text,
  default_vat_rate       numeric(5, 2) not null default 23.00,
  default_payment_days   integer not null default 14,
  -- Wzorzec numeru faktury; {nr} = kolejny numer, {rok} = rok, {mies} = miesiąc.
  invoice_number_pattern text not null default 'FV/{nr}/{rok}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint organizations_payment_days_check check (default_payment_days between 0 and 180),
  constraint organizations_vat_rate_check check (default_vat_rate >= 0 and default_vat_rate <= 100)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'lawyer',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id) where active;

-- Bezpieczny katalog użytkowników. Synchronizowany triggerem z auth.users.
-- NIGDY nie budować widoku czytającego auth.users bezpośrednio — Supabase
-- zgłasza to jako ostrzeżenie auth_users_exposed i jest to realny wyciek.
create table public.user_directory_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        citext not null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index user_directory_profiles_email_idx on public.user_directory_profiles (email);

-- Stawki godzinowe prawników w osobnej tabeli, nie jako kolumna w
-- organization_members. RLS działa na wierszach, nie na kolumnach — trzymanie
-- stawek obok członkostwa oznaczałoby, że każdy czytający listę zespołu widzi
-- cudze stawki. Ten sam wzorzec co employee_compensation w panelu GolBud.
create table public.member_rates (
  organization_id           uuid not null,
  user_id                   uuid not null,
  default_hourly_rate_grosz bigint not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade,
  constraint member_rates_nonnegative check (default_hourly_rate_grosz >= 0)
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

create trigger user_directory_profiles_set_updated_at
  before update on public.user_directory_profiles
  for each row execute function public.set_updated_at();

create trigger member_rates_set_updated_at
  before update on public.member_rates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Synchronizacja katalogu z auth.users
-- ---------------------------------------------------------------------------

create or replace function public.sync_user_directory_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_directory_profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do update
    set email        = excluded.email,
        -- Nie nadpisujemy nazwy ustawionej ręcznie w aplikacji.
        display_name = coalesce(public.user_directory_profiles.display_name, excluded.display_name),
        updated_at   = now();
  return new;
end;
$$;

create trigger sync_user_directory_profile_on_auth_users
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_user_directory_profile();

-- ---------------------------------------------------------------------------
-- Funkcje pomocnicze SECURITY DEFINER
--
-- Wszystkie omijają RLS, dzięki czemu mogą być bezpiecznie wołane z polityk
-- na organization_members bez wywoływania rekurencji.
-- ---------------------------------------------------------------------------

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and active;
$$;

create or replace function public.is_member_of(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_org
      and user_id = auth.uid()
      and active
  );
$$;

create or replace function public.my_role_in(p_org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.organization_members
  where organization_id = p_org
    and user_id = auth.uid()
    and active;
$$;

create or replace function public.has_role_in(p_org uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_org
      and user_id = auth.uid()
      and active
      and role = any (p_roles)
  );
$$;

create or replace function public.is_owner_of(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role_in(p_org, array['owner']::public.org_role[]);
$$;

-- Wgląd w finanse: stawki, faktury, rentowność zespołu.
create or replace function public.can_see_finances(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role_in(p_org, array['owner', 'partner']::public.org_role[]);
$$;

-- Czy bieżący użytkownik dzieli organizację ze wskazaną osobą.
-- Używane przez politykę na katalogu użytkowników.
create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.active
      and theirs.user_id = p_user
      and theirs.active
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.user_directory_profiles enable row level security;
alter table public.member_rates            enable row level security;

-- Wymuszamy RLS także dla właściciela tabel.
alter table public.organizations           force row level security;
alter table public.organization_members    force row level security;
alter table public.user_directory_profiles force row level security;
alter table public.member_rates            force row level security;

-- organizations ------------------------------------------------------------
-- Brak INSERT dla authenticated: organizację zakłada wyłącznie RPC rejestrujące
-- pierwszego właściciela (migracja 0003).
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member_of(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_owner_of(id))
  with check (public.is_owner_of(id));

-- organization_members -----------------------------------------------------
-- KLUCZOWE: brak INSERT/UPDATE/DELETE dla roli authenticated.
-- Członkostwo zakłada i zmienia wyłącznie RPC set_member_role (migracja 0003).
-- Dzięki temu nie da się dopisać sobie dostępu do cudzej organizacji.
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_member_of(organization_id));

-- user_directory_profiles --------------------------------------------------
create policy user_directory_profiles_select on public.user_directory_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.shares_org_with(user_id));

create policy user_directory_profiles_update_self on public.user_directory_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- member_rates -------------------------------------------------------------
-- Własną stawkę widzi każdy; cudze wyłącznie owner i partner.
create policy member_rates_select on public.member_rates
  for select to authenticated
  using (
    (user_id = auth.uid() and public.is_member_of(organization_id))
    or public.can_see_finances(organization_id)
  );

create policy member_rates_write on public.member_rates
  for all to authenticated
  using (public.is_owner_of(organization_id))
  with check (public.is_owner_of(organization_id));

-- ---------------------------------------------------------------------------
-- Uprawnienia
-- ---------------------------------------------------------------------------

grant select                         on public.organizations           to authenticated;
grant update                         on public.organizations           to authenticated;
grant select                         on public.organization_members    to authenticated;
grant select, update                 on public.user_directory_profiles to authenticated;
grant select, insert, update, delete on public.member_rates            to authenticated;

-- Funkcje pomocnicze są bezpieczne do wywołania przez zalogowanego użytkownika:
-- wszystkie operują wyłącznie na auth.uid() i nie przyjmują tożsamości z zewnątrz.
grant execute on function public.my_org_ids()                                       to authenticated;
grant execute on function public.is_member_of(uuid)                                 to authenticated;
grant execute on function public.my_role_in(uuid)                                   to authenticated;
grant execute on function public.has_role_in(uuid, public.org_role[])               to authenticated;
grant execute on function public.is_owner_of(uuid)                                  to authenticated;
grant execute on function public.can_see_finances(uuid)                             to authenticated;
grant execute on function public.shares_org_with(uuid)                              to authenticated;
