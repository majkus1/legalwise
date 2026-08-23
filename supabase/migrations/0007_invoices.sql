-- 0007 — Fakturowanie: numeracja, pozycje, powiązanie z ewidencją czasu, KSeF.
--
-- Wszystkie kwoty w groszach (bigint). Stawka VAT jako numeric(5,2) w procentach.
--
-- STATUS WOBEC KSeF: dopóki integracja nie jest podłączona, faktura wystawiona
-- w tym module nie wchodzi do obiegu prawnego (KSeF jest obowiązkowy od
-- 1.04.2026). Moduł służy przygotowaniu rozliczeń i zestawień godzin.
-- Struktura danych jest kompletna pod FA(3), żeby podłączenie wysyłki nie
-- wymagało migracji danych.

create type public.invoice_status as enum ('draft', 'approved', 'sent', 'paid', 'anulowana');
create type public.ksef_status    as enum ('not_sent', 'pending', 'accepted', 'error');
create type public.payment_method as enum ('przelew', 'gotowka', 'karta', 'inna');

-- ---------------------------------------------------------------------------
-- Numeracja
--
-- Numer nadawany jest dopiero przy ZATWIERDZANIU faktury, nigdy przy tworzeniu
-- szkicu. Dzięki temu porzucone szkice nie robią dziur w numeracji, a dziura
-- w numeracji faktur jest wadą, nie drobiazgiem.
-- ---------------------------------------------------------------------------

create table public.invoice_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year            integer not null,
  next_number     integer not null default 1,
  primary key (organization_id, year),
  constraint invoice_sequences_positive check (next_number >= 1)
);

alter table public.invoice_sequences enable row level security;
alter table public.invoice_sequences force row level security;
-- Brak jakiegokolwiek dostępu dla roli authenticated: sekwencją zarządza
-- wyłącznie funkcja next_invoice_number() działająca jako SECURITY DEFINER.

create or replace function public.next_invoice_number(p_org uuid, p_year integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_number integer;
begin
  -- Upsert jest atomowy: przy konflikcie Postgres blokuje wiersz, więc dwa
  -- równoległe zatwierdzenia nie mogą otrzymać tego samego numeru.
  -- W obu gałęziach (wstawienie i aktualizacja) poprawnym wynikiem jest
  -- next_number - 1, bo kolumna trzyma zawsze NASTĘPNY wolny numer.
  insert into public.invoice_sequences as s (organization_id, year, next_number)
  values (p_org, p_year, 2)
  on conflict (organization_id, year)
    do update set next_number = s.next_number + 1
  returning s.next_number - 1 into v_number;

  return v_number;
end;
$$;

-- Złożenie numeru wg wzorca kancelarii, np. 'FV/{nr}/{rok}' → 'FV/7/2026'.
create or replace function public.format_invoice_number(
  p_pattern text, p_number integer, p_year integer, p_month integer
)
returns text
language sql
immutable
as $$
  select replace(
           replace(
             replace(coalesce(p_pattern, 'FV/{nr}/{rok}'), '{nr}', p_number::text),
             '{rok}', p_year::text),
           '{mies}', lpad(p_month::text, 2, '0'));
$$;

-- ---------------------------------------------------------------------------
-- Faktury
-- ---------------------------------------------------------------------------

create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete restrict,
  status             public.invoice_status not null default 'draft',

  -- Numer nadawany przy zatwierdzeniu; w szkicu jest pusty.
  number             text,
  sequence_number    integer,
  sequence_year      integer,

  issue_date         date,                    -- data wystawienia
  sale_date          date,                    -- data wykonania usługi / sprzedaży
  due_date           date,                    -- termin płatności
  payment_method     public.payment_method not null default 'przelew',
  currency           text not null default 'PLN',

  -- Okres rozliczeniowy, którego dotyczy zestawienie godzin.
  period_from        date,
  period_to          date,

  -- Migawka danych stron. Faktura musi utrwalać stan z chwili wystawienia —
  -- późniejsza zmiana adresu klienta nie może zmieniać wystawionego dokumentu.
  seller_name        text,
  seller_tax_id      text,
  seller_address     text,
  seller_bank_account text,
  buyer_name         text,
  buyer_tax_id       text,
  buyer_address      text,

  total_net_grosz    bigint not null default 0,
  total_vat_grosz    bigint not null default 0,
  total_gross_grosz  bigint not null default 0,

  notes              text,

  -- KSeF. Wypełniane dopiero po podłączeniu integracji.
  ksef_status              public.ksef_status not null default 'not_sent',
  ksef_session_reference   text,   -- referenceNumber sesji (POST /sessions/online)
  ksef_invoice_reference   text,   -- referenceNumber faktury w sesji
  ksef_upo_xml             text,   -- Urzędowe Poświadczenie Odbioru
  ksef_sent_at             timestamptz,
  ksef_error               text,

  approved_at        timestamptz,
  approved_by        uuid references auth.users (id) on delete set null,
  paid_at            timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint invoices_number_unique unique (organization_id, number),
  constraint invoices_totals_nonnegative check (
    total_net_grosz >= 0 and total_vat_grosz >= 0 and total_gross_grosz >= 0
  ),
  constraint invoices_period_order check (
    period_from is null or period_to is null or period_to >= period_from
  ),
  -- Zatwierdzona faktura musi mieć numer i datę wystawienia.
  constraint invoices_approved_has_number check (
    status = 'draft' or (number is not null and issue_date is not null)
  )
);

create index invoices_org_status_idx on public.invoices (organization_id, status, issue_date desc);
create index invoices_client_idx on public.invoices (client_id, issue_date desc);
create index invoices_ksef_idx on public.invoices (organization_id, ksef_status)
  where ksef_status <> 'not_sent';

create table public.invoice_items (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  invoice_id            uuid not null references public.invoices (id) on delete cascade,
  case_id               uuid references public.cases (id) on delete set null,
  position              integer not null default 1,
  description           text not null,
  quantity              numeric(12, 4) not null default 1,
  unit                  text not null default 'godz.',
  unit_price_net_grosz  bigint not null default 0,
  vat_rate              numeric(5, 2) not null default 23.00,
  -- Kolumny wyliczane triggerem; nie ustawiać ręcznie.
  net_grosz             bigint not null default 0,
  vat_grosz             bigint not null default 0,
  gross_grosz           bigint not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint invoice_items_quantity_positive check (quantity > 0),
  constraint invoice_items_price_nonnegative check (unit_price_net_grosz >= 0),
  constraint invoice_items_vat_range check (vat_rate >= 0 and vat_rate <= 100),
  constraint invoice_items_description_present check (length(trim(description)) > 0)
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

-- Powiązanie ewidencji czasu z fakturą. Na tej podstawie powstaje załącznik
-- godzinowy dla klienta — czyli to, co dziś kancelaria składa ręcznie w Excelu.
alter table public.time_entries
  add column invoice_id uuid references public.invoices (id) on delete set null;

create index time_entries_invoice_idx on public.time_entries (invoice_id)
  where invoice_id is not null;

create trigger invoices_set_updated_at
  before update on public.invoices for each row execute function public.set_updated_at();
create trigger invoice_items_set_updated_at
  before update on public.invoice_items for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Wyliczanie kwot
--
-- Kwoty liczy baza, nie interfejs. Zaokrąglenie następuje raz, na poziomie
-- pozycji; sumy faktury są sumą zaokrąglonych pozycji, dzięki czemu
-- suma kontrolna zawsze się zgadza.
-- ---------------------------------------------------------------------------

create or replace function public.invoice_items_compute()
returns trigger
language plpgsql
as $$
begin
  new.net_grosz   := round(new.quantity * new.unit_price_net_grosz);
  new.vat_grosz   := round(new.net_grosz * new.vat_rate / 100.0);
  new.gross_grosz := new.net_grosz + new.vat_grosz;
  return new;
end;
$$;

create trigger invoice_items_compute_trg
  before insert or update on public.invoice_items
  for each row execute function public.invoice_items_compute();

create or replace function public.recalc_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update public.invoices i
  set total_net_grosz   = coalesce(t.net, 0),
      total_vat_grosz   = coalesce(t.vat, 0),
      total_gross_grosz = coalesce(t.gross, 0),
      updated_at        = now()
  from (
    select sum(net_grosz) as net, sum(vat_grosz) as vat, sum(gross_grosz) as gross
    from public.invoice_items
    where invoice_id = v_invoice
  ) t
  where i.id = v_invoice;

  return null;
end;
$$;

create trigger invoice_items_recalc_totals
  after insert or update or delete on public.invoice_items
  for each row execute function public.recalc_invoice_totals();

-- Zatwierdzonej faktury nie wolno edytować. Poprawka wymaga anulowania
-- i wystawienia nowego dokumentu (a docelowo faktury korygującej).
create or replace function public.invoice_items_guard_approved()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.invoice_status;
begin
  select status into v_status
  from public.invoices
  where id = coalesce(new.invoice_id, old.invoice_id);

  if v_status is distinct from 'draft' then
    raise exception 'Faktura nie jest szkicem — pozycji nie można zmieniać'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger invoice_items_guard_approved_trg
  before insert or update or delete on public.invoice_items
  for each row execute function public.invoice_items_guard_approved();

-- ---------------------------------------------------------------------------
-- Zatwierdzenie faktury
--
-- Operacja nieodwracalna: nadaje numer, utrwala dane stron i blokuje
-- powiązane wpisy czasu.
-- ---------------------------------------------------------------------------

create or replace function public.approve_invoice(p_invoice uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv     public.invoices;
  v_org     public.organizations;
  v_client  public.clients;
  v_year    integer;
  v_number  integer;
  v_issue   date;
begin
  select * into v_inv from public.invoices where id = p_invoice;

  if v_inv.id is null then
    raise exception 'Nie znaleziono faktury' using errcode = 'P0002';
  end if;

  if not public.can_see_finances(v_inv.organization_id) then
    raise exception 'Brak uprawnień do zatwierdzania faktur' using errcode = '42501';
  end if;

  if v_inv.status <> 'draft' then
    raise exception 'Faktura została już zatwierdzona' using errcode = '22023';
  end if;

  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice) then
    raise exception 'Nie można zatwierdzić faktury bez pozycji' using errcode = '22023';
  end if;

  select * into v_org from public.organizations where id = v_inv.organization_id;
  select * into v_client from public.clients where id = v_inv.client_id;

  v_issue := coalesce(v_inv.issue_date, current_date);
  v_year  := extract(year from v_issue)::integer;
  v_number := public.next_invoice_number(v_inv.organization_id, v_year);

  update public.invoices
  set status          = 'approved',
      number          = public.format_invoice_number(
                          v_org.invoice_number_pattern, v_number, v_year,
                          extract(month from v_issue)::integer),
      sequence_number = v_number,
      sequence_year   = v_year,
      issue_date      = v_issue,
      sale_date       = coalesce(sale_date, v_issue),
      due_date        = coalesce(due_date, v_issue + v_org.default_payment_days),
      -- Migawki danych stron
      seller_name         = coalesce(v_org.legal_name, v_org.name),
      seller_tax_id       = v_org.tax_id,
      seller_address      = concat_ws(', ',
                              nullif(v_org.address_line1, ''),
                              nullif(v_org.address_line2, ''),
                              nullif(concat_ws(' ', v_org.postal_code, v_org.city), '')),
      seller_bank_account = v_org.bank_account,
      buyer_name          = v_client.name,
      buyer_tax_id        = v_client.tax_id,
      buyer_address       = concat_ws(', ',
                              nullif(v_client.address_line1, ''),
                              nullif(v_client.address_line2, ''),
                              nullif(concat_ws(' ', v_client.postal_code, v_client.city), '')),
      approved_at     = now(),
      approved_by     = auth.uid(),
      updated_at      = now()
  where id = p_invoice
  returning * into v_inv;

  -- Blokada wpisów czasu wchodzących do tej faktury.
  update public.time_entries
  set locked_at = now()
  where invoice_id = p_invoice
    and locked_at is null;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (v_inv.organization_id, auth.uid(), 'invoice.approve', 'invoice', p_invoice::text,
          jsonb_build_object('number', v_inv.number,
                             'total_gross_grosz', v_inv.total_gross_grosz,
                             'client_id', v_inv.client_id));

  return v_inv;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anulowanie faktury
--
-- Numer pozostaje zajęty — zwolnienie go zrobiłoby dziurę w numeracji.
-- Wpisy czasu wracają do puli niezafakturowanych.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_invoice(p_invoice uuid, p_reason text default null)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice;

  if v_inv.id is null then
    raise exception 'Nie znaleziono faktury' using errcode = 'P0002';
  end if;

  if not public.can_see_finances(v_inv.organization_id) then
    raise exception 'Brak uprawnień do anulowania faktur' using errcode = '42501';
  end if;

  if v_inv.status = 'anulowana' then
    raise exception 'Faktura jest już anulowana' using errcode = '22023';
  end if;

  if v_inv.ksef_status = 'accepted' then
    raise exception 'Faktura przyjęta przez KSeF wymaga faktury korygującej, nie anulowania'
      using errcode = '42501';
  end if;

  update public.invoices
  set status = 'anulowana',
      notes  = concat_ws(E'\n', notes, nullif(concat('Anulowano: ', p_reason), 'Anulowano: ')),
      updated_at = now()
  where id = p_invoice
  returning * into v_inv;

  update public.time_entries
  set locked_at = null, invoice_id = null
  where invoice_id = p_invoice;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (v_inv.organization_id, auth.uid(), 'invoice.cancel', 'invoice', p_invoice::text,
          jsonb_build_object('number', v_inv.number, 'reason', p_reason));

  return v_inv;
end;
$$;

grant execute on function public.approve_invoice(uuid)      to authenticated;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;
grant execute on function public.format_invoice_number(text, integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Faktury i pozycje widzą wyłącznie osoby z wglądem w finanse.
-- ---------------------------------------------------------------------------

alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoices      force row level security;
alter table public.invoice_items force row level security;

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.can_see_finances(organization_id));

create policy invoices_write on public.invoices
  for all to authenticated
  using (public.can_see_finances(organization_id))
  with check (public.can_see_finances(organization_id));

create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (public.can_see_finances(organization_id));

create policy invoice_items_write on public.invoice_items
  for all to authenticated
  using (public.can_see_finances(organization_id))
  with check (public.can_see_finances(organization_id));

grant select, insert, update, delete on public.invoices      to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
