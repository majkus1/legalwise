import type { BillingModel, ClientType } from "@/lib/domain";

/**
 * Kształt formularza klienta i jego wartości domyślne.
 *
 * Moduł bez dyrektywy "use client" — wartości początkowe przygotowuje
 * komponent serwerowy, a ten nie może sięgać po eksporty modułu klienckiego
 * inaczej niż renderując komponent lub przekazując właściwości.
 */
export interface ClientFormValues {
  id?: string;
  name: string;
  clientType: ClientType;
  taxId: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  email: string;
  billingEmail: string;
  phone: string;
  defaultBillingModel: BillingModel;
  defaultHourlyRate: string;
  notes: string;
}

export const EMPTY_CLIENT: ClientFormValues = {
  name: "",
  clientType: "firma",
  taxId: "",
  addressLine1: "",
  postalCode: "",
  city: "",
  email: "",
  billingEmail: "",
  phone: "",
  defaultBillingModel: "godzinowy",
  defaultHourlyRate: "",
  notes: "",
};
