import { renderToBuffer } from "@react-pdf/renderer";
import { requireFinanceContext } from "@/lib/auth";
import { loadInvoiceBundle, toAnnexPdfData } from "@/lib/invoice-data";
import { AnnexDocument } from "@/lib/pdf/annex-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zestawienie godzin — załącznik do faktury przekazywany klientowi.
 *
 * To jest dokument, który kancelaria składała dotąd ręcznie w arkuszu
 * kalkulacyjnym przy każdym zamknięciu okresu.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/faktury/[id]/zestawienie">,
) {
  const context = await requireFinanceContext();
  const { id } = await params;

  const bundle = await loadInvoiceBundle(id, context.organizationId);
  if (!bundle) {
    return new Response("Nie znaleziono faktury", { status: 404 });
  }

  const pdf = await renderToBuffer(<AnnexDocument data={toAnnexPdfData(bundle)} />);
  const fileName = `zestawienie-${(bundle.number ?? "projekt").replace(/[^\w-]/g, "-")}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
