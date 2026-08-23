-- 0003 — Dziennik audytu oraz RPC zarządzające członkostwem.
--
-- Tabela organization_members nie przyjmuje zapisów od roli authenticated
-- (patrz 0002). Jedyną drogą nadania lub odebrania dostępu są funkcje poniżej,
-- które weryfikują uprawnienia i zapisują ślad w dzienniku audytu.

-- ---------------------------------------------------------------------------
-- Dziennik audytu
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id              bigserial primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null,
  entity          text,
  entity_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (organization_id, entity, entity_id);

comment on table public.audit_log is
  'Ślad dostępu i zmian. Wymagany przy tajemnicy zawodowej i rozliczalności z RODO.
   Zapis wyłącznie przez public.log_audit() — brak INSERT dla roli authenticated.';

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Dziennik czytają wyłącznie osoby zarządzające kancelarią.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.can_see_finances(organization_id));

grant select on public.audit_log to authenticated;

-- Zapis do dziennika. SECURITY DEFINER, bo tabela nie przyjmuje INSERT od
-- authenticated. Tożsamość sprawcy jest wymuszona z auth.uid() i nie może być
-- podana z zewnątrz — nie da się podszyć pod inną osobę.
create or replace function public.log_audit(
  p_org       uuid,
  p_action    text,
  p_entity    text default null,
  p_entity_id text default null,
  p_metadata  jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak zalogowanego użytkownika' using errcode = '28000';
  end if;

  if p_org is not null and not public.is_member_of(p_org) then
    raise exception 'Brak dostępu do organizacji' using errcode = '42501';
  end if;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (p_org, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

grant execute on function public.log_audit(uuid, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap kancelarii
--
-- Zakłada organizację i czyni wywołującego właścicielem. Działa TYLKO wtedy,
-- gdy w bazie nie ma jeszcze żadnej organizacji. Dzięki temu po pierwszej
-- konfiguracji nikt nie może obejść ekranu oczekiwania na dostęp, zakładając
-- sobie własną organizację.
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak zalogowanego użytkownika' using errcode = '28000';
  end if;

  if exists (select 1 from public.organizations) then
    raise exception 'Kancelaria jest już skonfigurowana. Poproś właściciela o nadanie dostępu.'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nazwa kancelarii jest wymagana' using errcode = '22023';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role, active)
  values (v_org, auth.uid(), 'owner', true);

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (v_org, auth.uid(), 'organization.bootstrap', 'organization', v_org::text,
          jsonb_build_object('name', trim(p_name)));

  return v_org;
end;
$$;

grant execute on function public.bootstrap_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nadawanie i zmiana roli
--
-- Właściciel wpisuje adres e-mail osoby, która się zarejestrowała, i nadaje jej
-- rolę. To jest jedyne wejście do organizacji.
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role(
  p_org   uuid,
  p_email citext,
  p_role  public.org_role
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user       uuid;
  v_prev_role  public.org_role;
  v_prev_active boolean;
begin
  if not public.is_owner_of(p_org) then
    raise exception 'Tylko właściciel może zarządzać dostępem' using errcode = '42501';
  end if;

  select user_id into v_user
  from public.user_directory_profiles
  where email = p_email;

  if v_user is null then
    raise exception 'Nie znaleziono użytkownika o adresie %. Osoba musi najpierw założyć konto.', p_email
      using errcode = 'P0002';
  end if;

  select role, active into v_prev_role, v_prev_active
  from public.organization_members
  where organization_id = p_org and user_id = v_user;

  -- Nie wolno odebrać roli ostatniemu aktywnemu właścicielowi.
  if v_prev_role = 'owner' and v_prev_active and p_role <> 'owner' then
    if (select count(*) from public.organization_members
        where organization_id = p_org and role = 'owner' and active) <= 1 then
      raise exception 'Nie można odebrać roli ostatniemu właścicielowi' using errcode = '23514';
    end if;
  end if;

  insert into public.organization_members (organization_id, user_id, role, active)
  values (p_org, v_user, p_role, true)
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        active = true,
        updated_at = now();

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (p_org, auth.uid(), 'member.set_role', 'user', v_user::text,
          jsonb_build_object('email', p_email::text,
                             'role_from', v_prev_role,
                             'role_to', p_role,
                             'was_active', v_prev_active));

  return v_user;
end;
$$;

grant execute on function public.set_member_role(uuid, citext, public.org_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Odebranie dostępu
--
-- Dezaktywacja, nie usunięcie — historia wpisów czasu i autorstwo notatek
-- muszą pozostać spójne. Odcięcie działa natychmiast, bo my_org_ids()
-- i is_member_of() filtrują po active.
-- ---------------------------------------------------------------------------

create or replace function public.deactivate_member(p_org uuid, p_email citext)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_role public.org_role;
begin
  if not public.is_owner_of(p_org) then
    raise exception 'Tylko właściciel może zarządzać dostępem' using errcode = '42501';
  end if;

  select user_id into v_user
  from public.user_directory_profiles
  where email = p_email;

  if v_user is null then
    raise exception 'Nie znaleziono użytkownika o adresie %', p_email using errcode = 'P0002';
  end if;

  select role into v_role
  from public.organization_members
  where organization_id = p_org and user_id = v_user and active;

  if v_role is null then
    raise exception 'Ta osoba nie ma aktywnego dostępu' using errcode = 'P0002';
  end if;

  if v_role = 'owner'
     and (select count(*) from public.organization_members
          where organization_id = p_org and role = 'owner' and active) <= 1 then
    raise exception 'Nie można odebrać dostępu ostatniemu właścicielowi' using errcode = '23514';
  end if;

  update public.organization_members
  set active = false, updated_at = now()
  where organization_id = p_org and user_id = v_user;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (p_org, auth.uid(), 'member.deactivate', 'user', v_user::text,
          jsonb_build_object('email', p_email::text, 'role', v_role));
end;
$$;

grant execute on function public.deactivate_member(uuid, citext) to authenticated;

-- ---------------------------------------------------------------------------
-- Lista zespołu
--
-- Łączy członkostwo z katalogiem e-maili. Zwraca dane wyłącznie członkom
-- organizacji; stawek tu nie ma (są w member_rates z własnym RLS).
-- ---------------------------------------------------------------------------

create or replace function public.organization_member_directory(p_org uuid)
returns table (
  user_id      uuid,
  email        citext,
  display_name text,
  role         public.org_role,
  active       boolean,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, p.email, p.display_name, m.role, m.active, m.created_at
  from public.organization_members m
  join public.user_directory_profiles p on p.user_id = m.user_id
  where m.organization_id = p_org
    and public.is_member_of(p_org)
  order by m.role, p.display_name nulls last, p.email;
$$;

grant execute on function public.organization_member_directory(uuid) to authenticated;
