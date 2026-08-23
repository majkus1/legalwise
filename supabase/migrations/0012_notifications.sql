-- 0012 — Powiadomienia: skrzynka w aplikacji, Web Push, preferencje i księga wysyłek.
--
-- Architektura przeniesiona ze sprawdzonego rozwiązania w panelu GolBud.
-- Trzy kanały: skrzynka w aplikacji, powiadomienie push i e-mail.

create type public.notification_kind as enum (
  'brak_formalny_termin',   -- brak formalny zbliża się lub minął
  'termin_procesowy',       -- rozprawa, posiedzenie, termin sądowy
  'zadanie_przypisane',
  'zadanie_po_terminie',
  'sprawa_przypisanie',
  'zamkniecie_okresu',      -- przypomnienie o rozliczeniu miesiąca
  'faktura_status',
  'poranny_przeglad'
);

-- ---------------------------------------------------------------------------
-- Skrzynka powiadomień
-- ---------------------------------------------------------------------------

create table public.user_notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            public.notification_kind not null,
  title           text not null,
  body            text,
  /** Ścieżka w aplikacji, do której prowadzi powiadomienie. */
  url             text,
  /**
   * Klucz zdarzenia — zapewnia idempotencję powiadomień cyklicznych.
   * Cron uruchomiony dwa razy tego samego dnia nie zdubluje wiadomości.
   */
  event_key       text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);
create index user_notifications_unread_idx
  on public.user_notifications (user_id) where read_at is null;
create unique index user_notifications_event_key_unique
  on public.user_notifications (user_id, event_key) where event_key is not null;

-- ---------------------------------------------------------------------------
-- Subskrypcje Web Push
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Preferencje
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- Poranny przegląd i jego sekcje
  digest_enabled       boolean not null default true,
  include_deadlines    boolean not null default true,  -- rozprawy i terminy procesowe
  include_deficiencies boolean not null default true,  -- braki formalne
  include_tasks        boolean not null default true,
  include_billing      boolean not null default true,  -- godziny do zafakturowania, faktury po terminie
  -- Powiadomienia natychmiastowe
  notify_task_assigned boolean not null default true,
  notify_case_assigned boolean not null default true,
  notify_deadlines     boolean not null default true,
  -- Kanały
  email_enabled        boolean not null default true,
  push_enabled         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Księga wysyłek
--
-- Unikalny dedupe_key daje jednocześnie deduplikację i ograniczenie tempa:
-- ta sama wiadomość nie wyjdzie dwa razy, a licznik z ostatniej minuty
-- pozwala zatrzymać lawinę, gdyby coś poszło nie tak.
--
-- RLS bez żadnych polityk i bez uprawnień dla roli authenticated — tabela
-- jest używana wyłącznie przez kod serwerowy z kluczem serwisowym.
-- ---------------------------------------------------------------------------

create table public.notification_dispatch_events (
  id              bigserial primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  channel         text not null check (channel in ('inbox', 'push', 'email')),
  dedupe_key      text not null unique,
  status          text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error           text,
  created_at      timestamptz not null default now()
);

create index notification_dispatch_recent_idx
  on public.notification_dispatch_events (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_notifications          enable row level security;
alter table public.push_subscriptions          enable row level security;
alter table public.notification_preferences    enable row level security;
alter table public.notification_dispatch_events enable row level security;

alter table public.user_notifications          force row level security;
alter table public.push_subscriptions          force row level security;
alter table public.notification_preferences    force row level security;
alter table public.notification_dispatch_events force row level security;

-- Powiadomienia czyta wyłącznie ich adresat.
create policy user_notifications_select on public.user_notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Oznaczanie jako przeczytane — również tylko własnych.
create policy user_notifications_update on public.user_notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Subskrypcje push są prywatne: identyfikują konkretne urządzenie.
create policy push_subscriptions_all on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.is_member_of(organization_id))
  with check (user_id = auth.uid() and public.is_member_of(organization_id));

create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner_of(organization_id));

create policy notification_preferences_write on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid() and public.is_member_of(organization_id))
  with check (user_id = auth.uid() and public.is_member_of(organization_id));

grant select, update          on public.user_notifications       to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update  on public.notification_preferences  to authenticated;
-- notification_dispatch_events: świadomie bez żadnych uprawnień.

-- ---------------------------------------------------------------------------
-- Włączenie push przez samego użytkownika
--
-- Nie wymaga pośrednictwa właściciela: zgoda na powiadomienia jest decyzją
-- osoby, która siedzi przy urządzeniu.
-- ---------------------------------------------------------------------------

create or replace function public.set_own_push_enabled(p_org uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_member_of(p_org) then
    raise exception 'Brak dostępu do kancelarii' using errcode = '42501';
  end if;

  insert into public.notification_preferences (organization_id, user_id, push_enabled)
  values (p_org, auth.uid(), p_enabled)
  on conflict (organization_id, user_id)
    do update set push_enabled = excluded.push_enabled, updated_at = now();
end;
$$;

grant execute on function public.set_own_push_enabled(uuid, boolean) to authenticated;

-- Oznaczenie wszystkich powiadomień jako przeczytane.
create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.user_notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
