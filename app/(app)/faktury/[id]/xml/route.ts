import { requireFinanceContext } from "@/lib/auth";
import { loadInvoiceBundle } from "@/lib/invoice-data";
import { buildFa3Xml, prettyPrintXml, type Fa3Invoice } from "@/lib/ksef/fa3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Faktura w strukturze FA(3) — plik, który trafi do KSeF po podłączeniu wysyłki.
 *
 * Udostępniamy go już teraz, bo „gotowe na KSeF" powinno być czymś, co klient
 * może zobaczyć i sprawdzić, a nie deklaracją na slajdzie.
 *
 * Parametr ?podglad=1 zwraca wersję z wcięciami do wyświetlenia w przeglądarce.
 */
export async function GET(request: Request, { params }: RouteContext<"/faktury/[id]/xml">) {
  const context = await requireFinanceContext();
  const { id } = await params;

  const bundle = await loadInvoiceBundle(id, context.organizationId);
  if (!bundle) {
    return new Response("Nie znaleziono faktury", { status: 404 });
  }

  if (bundle.status === "draft") {
    return new Response(
      "Plik XML powstaje dopiero dla zatwierdzonej faktury — szkic nie ma jeszcze numeru.",
      { status: 409 },
    );
  }

  const invoice: Fa3Invoice = {
    number: bundle.number!,
    issueDate: bundle.issueDate!,
    saleDate: bundle.saleDate,
    dueDate: bundle.dueDate,
    currency: bundle.currency,
    seller: {
      taxId: bundle.seller.taxId,
      name: bundle.seller.name,
      countryCode: "PL",
      addressLine1: bundle.seller.addressLine1,
      addressLine2: bundle.seller.addressLine2,
    },
    buyer: {
      taxId: bundle.buyer.taxId,
      name: bundle.buyer.name,
      countryCode: "PL",
      addressLine1: bundle.buyer.addressLine1,
      addressLine2: bundle.buyer.addressLine2,
    },
    lines: bundle.lines.map((line) => ({
      name: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceNetGrosz: line.unitPriceNetGrosz,
      netGrosz: line.netGrosz,
      vatRate: line.vatRate,
    })),
    generatedAt: new Date(),
    notes:
      bundle.periodFrom && bundle.periodTo
        ? `Okres rozliczeniowy: ${bundle.periodFrom} – ${bundle.periodTo}`
        : null,
  };

  const xml = buildFa3Xml(invoice);
  const preview = new URL(request.url).searchParams.get("podglad") === "1";
  const fileName = `fa3-${bundle.number!.replace(/[^\w-]/g, "-")}.xml`;

  return new Response(preview ? prettyPrintXml(xml) : xml, {
    headers: {
      "Content-Type": preview ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8",
      "Content-Disposition": preview ? "inline" : `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
