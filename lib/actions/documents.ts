"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { normalizeForSearch } from "@/lib/text";

export interface ActionState {
  error?: string;
  message?: string;
}

// Uwaga: plik z dyrektywą "use server" może eksportować wyłącznie funkcje
// asynchroniczne. Stałe trzymamy lokalnie — gdyby były potrzebne gdzie indziej,
// ich miejscem jest osobny moduł bez tej dyrektywy.
const DOCUMENTS_BUCKET = "case-documents";

/** 25 MB — zgodnie z limitem ustawionym na buckecie w migracji 0008. */
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Dopuszczalne typy plików.
 *
 * Lista dozwolonych, nie zabronionych: repozytorium kancelarii ma trzymać
 * dokumenty, a nie dowolną zawartość. Odrzucamy w szczególności pliki
 * wykonywalne i archiwa, w których mogą się kryć.
 */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "message/rfc822",
]);

/**
 * Oczyszcza nazwę pliku do postaci bezpiecznej w ścieżce Storage.
 *
 * Nazwa pochodzi od użytkownika, więc nie może zawierać separatorów ścieżki
 * ani znaków spoza zakresu ASCII — polskie znaki w kluczu obiektu potrafią
 * rozjechać podpisywanie adresu.
 */
function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extension = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : "";

  const safeBase =
    normalizeForSearch(base)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "dokument";

  const safeExtension = extension.replace(/[^a-z0-9]/g, "").slice(0, 8);
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const caseId = z.string().uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { error: "Nieprawidłowy identyfikator sprawy" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Wybierz plik do wgrania" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { error: "Plik jest większy niż 25 MB" };
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return {
      error: "Ten typ pliku nie jest obsługiwany. Dopuszczamy dokumenty, arkusze, obrazy i wiadomości e-mail.",
    };
  }

  // Ścieżka odzwierciedla strukturę uprawnień: polityki na storage.objects
  // odczytują z niej identyfikator sprawy i pytają can_access_case().
  const storagePath = `${context.organizationId}/${caseId.data}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const supabase = await createServerSupabase();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { error: "Nie udało się wgrać pliku. Sprawdź, czy masz dostęp do tej sprawy." };
  }

  const { error: metaError } = await supabase.from("case_documents").insert({
    organization_id: context.organizationId,
    case_id: caseId.data,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: context.userId,
  });

  if (metaError) {
    // Metadanych nie ma, więc plik byłby niewidoczny i nieusuwalny z interfejsu.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { error: "Nie udało się zapisać informacji o pliku" };
  }

  revalidatePath(`/sprawy/${caseId.data}`);
  return { message: `Wgrano plik ${file.name}` };
}

/**
 * Zwraca krótkotrwały adres do pobrania pliku.
 *
 * Bucket jest prywatny i nie ma publicznych adresów — każde pobranie wymaga
 * podpisu wystawionego po sprawdzeniu dostępu do sprawy. Link żyje minutę,
 * więc skopiowany i przesłany dalej szybko przestaje działać.
 */
export async function createDocumentDownloadUrl(
  documentId: string,
): Promise<{ url?: string; error?: string }> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu" };

  const parsed = z.string().uuid().safeParse(documentId);
  if (!parsed.success) return { error: "Nieprawidłowy identyfikator dokumentu" };

  const supabase = await createServerSupabase();

  // Odczyt metadanych przechodzi przez RLS — jeśli użytkownik nie ma dostępu
  // do sprawy, nie zobaczy tu nic i nie dostanie podpisu.
  const { data: document } = await supabase
    .from("case_documents")
    .select("storage_path, file_name")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!document) return { error: "Nie znaleziono dokumentu" };

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, 60, { download: document.file_name });

  if (error || !data) return { error: "Nie udało się przygotować pobrania" };

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "document.download",
    p_entity: "case_document",
    p_entity_id: parsed.data,
    p_metadata: { file_name: document.file_name },
  });

  return { url: data.signedUrl };
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const context = await getOrgContext();
  if (!context) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  const caseId = z.string().uuid().safeParse(formData.get("caseId"));
  if (!id.success || !caseId.success) return;

  const supabase = await createServerSupabase();

  const { data: document } = await supabase
    .from("case_documents")
    .select("storage_path, file_name")
    .eq("id", id.data)
    .maybeSingle();

  if (!document) return;

  // Najpierw metadane: jeśli RLS odmówi, plik zostaje nietknięty.
  const { error } = await supabase.from("case_documents").delete().eq("id", id.data);
  if (error) return;

  await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.storage_path]);

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "document.delete",
    p_entity: "case_document",
    p_entity_id: id.data,
    p_metadata: { file_name: document.file_name },
  });

  revalidatePath(`/sprawy/${caseId.data}`);
}
