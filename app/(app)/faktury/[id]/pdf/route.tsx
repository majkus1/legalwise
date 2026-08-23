import { renderToBuffer } from "@react-pdf/renderer";
import { requireFinanceContext } from "@/lib/auth";
import { loadInvoiceBundle, toInvoicePdfData } from "@/lib/invoice-data";
import { InvoiceDocument } from "@/lib/pdf/invoice-document";

// Generowanie PDF wymaga środowiska Node (fontkit, dostęp do plików fontu).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/faktury/[id]/pdf">) {
  const context = await requireFinanceContext();
  const { id } = await params;

  const bundle = await loadInvoiceBundle(id, context.organizationId);
  if (!bundle) {
    return new Response("Nie znaleziono faktury", { status: 404 });
  }

  const pdf = await renderToBuffer(<InvoiceDocument data={toInvoicePdfData(bundle)} />);
  const fileName = `faktura-${(bundle.number ?? "projekt").replace(/[^\w-]/g, "-")}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      // Dokument zawiera dane objęte tajemnicą zawodową — żadnego cache'owania
      // po drodze.
      "Cache-Control": "private, no-store",
    },
  });
}
