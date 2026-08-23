"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export interface FormState {
  error?: string;
  message?: string;
}

/**
 * Wymagania dla hasła.
 *
 * System przechowuje dane objęte tajemnicą zawodową, więc dwanaście znaków
 * jest tu minimum rozsądku, a nie przesadą. Nie wymuszamy natomiast znaków
 * specjalnych — długość chroni lepiej niż wymuszona egzotyka, która kończy się
 * hasłem zapisanym na kartce.
 */
const passwordSchema = z
  .string()
  .min(12, "Hasło musi mieć co najmniej 12 znaków")
  .max(128, "Hasło jest za długie");

const emailSchema = z
  .string()
  .trim()
  .min(1, "Podaj adres e-mail")
  .email("To nie wygląda na poprawny adres e-mail");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Podaj hasło"),
});

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2, "Podaj imię i nazwisko").max(120),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Nieprawidłowe dane";
}

// ---------------------------------------------------------------------------

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Świadomie nie zdradzamy, czy konto istnieje — inaczej formularz
    // logowania staje się narzędziem do sprawdzania, kto pracuje w kancelarii.
    return { error: "Nieprawidłowy adres e-mail lub hasło" };
  }

  const returnTo = formData.get("powrot");
  const target = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/";
  redirect(target);
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Nie udało się założyć konta. Spróbuj ponownie lub skontaktuj się z kancelarią." };
  }

  // Konto powstaje bez żadnego dostępu do danych. Właściciel musi je dopiero
  // dodać do kancelarii — do tego czasu użytkownik widzi ekran oczekiwania.
  redirect("/oczekiwanie");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/logowanie");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createServerSupabase();
  // Link z e-maila wraca na /auth/callback, gdzie jednorazowy kod jest wymieniany
  // na sesję, a dopiero potem użytkownik trafia na formularz nowego hasła.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset`,
  });

  // Odpowiedź jest taka sama niezależnie od tego, czy konto istnieje.
  return {
    message:
      "Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do ustawienia nowego hasła.",
  };
}

export async function setNewPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = formData.get("password");
  const repeated = formData.get("passwordRepeat");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  if (password !== repeated) {
    return { error: "Hasła nie są takie same" };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Link wygasł. Poproś o nowy link do ustawienia hasła." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { error: "Nie udało się ustawić nowego hasła. Spróbuj ponownie." };
  }

  redirect("/");
}

/**
 * Jednorazowa konfiguracja kancelarii przez pierwszego użytkownika.
 * Baza odrzuci wywołanie, jeśli organizacja już istnieje.
 */
export async function bootstrapOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = z
    .string()
    .trim()
    .min(2, "Podaj nazwę kancelarii")
    .max(200)
    .safeParse(formData.get("name"));

  if (!name.success) {
    return { error: firstError(name.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("bootstrap_organization", { p_name: name.data });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
