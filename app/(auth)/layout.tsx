import { BrandLogo } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          System wewnętrzny kancelarii. Dane objęte tajemnicą zawodową.
        </p>
      </div>
    </div>
  );
}
