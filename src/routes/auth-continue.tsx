import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth-continue")({
  head: () => ({
    meta: [
      { title: "Continuar — SINA" },
      { name: "description", content: "Continue a ação de segurança da sua conta SINA." },
    ],
  }),
  component: AuthContinuePage,
});

function AuthContinuePage() {
  const target = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("url");
  }, []);

  const safeTarget = useMemo(() => {
    if (!target) return null;
    try {
      const url = new URL(target);
      const allowedHosts = new Set([
        "sinna.cloud",
        "zwapwxbczezqfghenrgy.supabase.co",
      ]);
      if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) return null;
      return url.toString();
    } catch {
      return null;
    }
  }, [target]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Segurança SINA</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Continuar com segurança</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Clique no botão abaixo para concluir a confirmação ou a recuperação da sua conta.
        </p>

        {safeTarget ? (
          <Button asChild className="mt-7 h-11 w-full font-semibold">
            <a href={safeTarget}>
              Continuar
              <ArrowRight />
            </a>
          </Button>
        ) : (
          <div className="mt-7 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-sm leading-6 text-destructive">
            Este link de segurança está ausente ou não é mais válido. Solicite um novo e-mail no SINA.
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          O SINA usa esta etapa para impedir que sistemas de segurança de e-mail consumam links de uso único antes de você.
        </p>
        <Link to="/auth" className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-4">
          Voltar para o acesso
        </Link>
      </section>
    </main>
  );
}
