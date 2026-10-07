import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleAuthButton({ loading, disabled, onClick }: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled}
      aria-busy={loading} className="h-11 w-full gap-3 font-semibold">
      {loading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : (
        <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24">
          <path className="fill-google-blue" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" />
          <path className="fill-google-green" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
          <path className="fill-google-yellow" d="M6.4 13.92A6 6 0 0 1 6.09 12c0-.67.11-1.32.31-1.92V7.49H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.51l3.34-2.59Z" />
          <path className="fill-google-red" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z" />
        </svg>
      )}
      <span aria-live="polite">{loading ? "Conectando ao Google…" : "Continuar com Google"}</span>
    </Button>
  );
}