-- 0008 — Repozytorium dokumentów w Supabase Storage.
--
-- Bucket jest PRYWATNY. Pliki są pobierane wyłącznie przez krótkotrwałe
-- signed URL generowane po stronie serwera, po sprawdzeniu dostępu do sprawy.
-- Publiczny URL nie istnieje — dokumenty kancelarii są objęte tajemnicą zawodową.
--
-- Konwencja ścieżki:   {organization_id}/{case_id}/{uuid}-{nazwa pliku}
-- Polityki poniżej odczytują z niej identyfikator sprawy i pytają
-- can_access_case(), czyli dokładnie tę samą regułę co reszta systemu.

insert into storage.buckets (id, name, public, file_size_limit)
values ('case-documents', 'case-documents', false, 26214400)  -- 25 MB
on conflict (id) do nothing;

-- Rzutowanie tekstu na uuid, które nie wywraca zapytania przy błędnej ścieżce.
-- Potrzebne, bo nazwa obiektu w Storage pochodzi z zewnątrz i nie musi być
-- poprawna — polityka ma wtedy po prostu odmówić, a nie zgłosić błąd.
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.safe_uuid(text) to authenticated;

-- Identyfikator sprawy wyciągnięty z drugiego segmentu ścieżki.
create or replace function public.storage_case_id(p_name text)
returns uuid
language sql
immutable
as $$
  select public.safe_uuid((storage.foldername(p_name))[2]);
$$;

grant execute on function public.storage_case_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Polityki na storage.objects
-- ---------------------------------------------------------------------------

create policy case_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and public.can_access_case(public.storage_case_id(name))
  );

create policy case_documents_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and public.can_access_case(public.storage_case_id(name))
  );

-- Nadpisanie istniejącego pliku traktujemy jak wgranie nowego —
-- wymaga dostępu do sprawy.
create policy case_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'case-documents'
    and public.can_access_case(public.storage_case_id(name))
  )
  with check (
    bucket_id = 'case-documents'
    and public.can_access_case(public.storage_case_id(name))
  );

create policy case_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'case-documents'
    and public.can_access_case(public.storage_case_id(name))
  );
