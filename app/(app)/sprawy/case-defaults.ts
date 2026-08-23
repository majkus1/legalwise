import type { CaseStatus, CaseType } from "@/lib/domain";

/**
 * Kształt formularza sprawy i jego wartości domyślne.
 *
 * Moduł celowo NIE ma dyrektywy "use client": komponent serwerowy nie może
 * wywołać funkcji pochodzącej z modułu klienckiego, a wartości początkowe
 * formularza są przygotowywane właśnie po stronie serwera.
 */
export interface CaseFormValues {
  id?: string;
  clientId: string;
  title: string;
  caseType: CaseType;
  status: CaseStatus;
  signature: string;
  courtName: string;
  courtDepartment: string;
  leadLawyerId: string;
  billingModel: string;
  hourlyRate: string;
  flatFee: string;
  flatFeeIncluded: string;
  description: string;
}

export function emptyCase(clientId = ""): CaseFormValues {
  return {
    clientId,
    title: "",
    caseType: "spor_sadowy",
    status: "aktywna",
    signature: "",
    courtName: "",
    courtDepartment: "",
    leadLawyerId: "",
    billingModel: "",
    hourlyRate: "",
    flatFee: "",
    flatFeeIncluded: "",
    description: "",
  };
}
