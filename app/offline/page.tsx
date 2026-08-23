import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Brak połączenia" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-muted">
              <WifiOff className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>Brak połączenia z internetem</CardTitle>
            <CardDescription>
              Aplikacja nie może teraz pobrać danych kancelarii.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Świadomie nie pokazujemy zapisanej wcześniej kopii spraw ani terminów.
              W kancelarii nieaktualny stan sprawy podany jako bieżący jest groźniejszy niż
              informacja o braku połączenia.
            </p>
            <p>Odśwież stronę, gdy połączenie wróci.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
