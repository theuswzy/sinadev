import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const FALLBACK_SUPABASE_URL = "https://zwapwxbczezqfghenrgy.supabase.co";

function getAllowedSupabaseOrigins() {
  const origins = new Set<string>();
  const configuredUrl = import.meta.env["VITE_SUPABASE_URL"];

  if (configuredUrl) {
    try {
      origins.add(new URL(configuredUrl).origin);
    } catch {
      // Keep the known project fallback if build-time configuration is invalid.
    }
  }

  origins.add(new URL(FALLBACK_SUPABASE_URL).origin);
  return origins;
}

/**
 * Supabase's ConfirmationURL contains its own query string. When it is
 * embedded directly in another query parameter, URLSearchParams sees pieces
 * such as "type" and "redirect_to" as outer parameters. Rebuild those pieces
 * before validating the one-time authentication URL.
 *
 * Supabase recommends this intermediary-page pattern specifically to protect
 * single-use auth links from email security scanners/prefetchers.
 */
function readConfirmationUrl() {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("confirmation_url") ?? params.get("url");

  if (!embedded) return null;

  try {
    const target = new URL(embedded);

    for (const [key, value] of params.entries()) {
      if (key === "confirmation_url" || key === "url") continue;

      if (
        key === "type" ||
        key === "redirect_to" ||
        key === "token_hash" ||
        key === "token"
      ) {
        if (!target.searchParams.has(key)) {
          target.searchParams.set(key, value);
        }
      }
    }

    return target.toString();
  } catch {
    return null;
  }
}

function validateConfirmationUrl(target: string | null) {
  if (!target) return null;

  try {
    const url = new URL(target);
    const allowedOrigins = getAllowedSupabaseOrigins();

    if (
      url.protocol !== "https:" ||
      !allowedOrigins.has(url.origin) ||
      url.pathname !== "/auth/v1/verify"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/auth-continue")({
  head: () => ({
    meta: [
      { title: "Confirmar e-mail — SINA" },
      {
        name: "description",
        content: "Confirme seu e-mail para concluir o cadastro no SINA.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AuthContinuePage,
});

function AuthContinuePage() {
  const [started, setStarted] = useState(false);

  const safeTarget = useMemo(
    () => validateConfirmationUrl(readConfirmationUrl()),
    [],
  );

  function continueConfirmation() {
    if (!safeTarget) return;

    // Do not expose the credential-bearing URL as an <a href>. Navigation
    // happens only after a deliberate user click.
    setStarted(true);
    window.location.assign(safeTarget);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Segurança SINA
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold">
          {safeTarget ? "Confirme seu e-mail" : "Link de confirmação inválido"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {safeTarget
            ? "Seu cadastro está quase concluído. Clique no botão abaixo para confirmar seu endereço de e-mail."
            : "Este link não pôde ser validado. Solicite um novo e-mail de confirmação no SINA."}
        </p>

        {safeTarget ? (
          <Button
            type="button"
            className="mt-7 h-11 w-full font-semibold"
            disabled={started}
            onClick={continueConfirmation}
          >
            {started ? "Confirmando…" : "Confirmar meu e-mail"}
            {!started && <ArrowRight />}
          </Button>
        ) : (
          <Link
            to="/auth"
            className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Voltar para o SINA
          </Link>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-secondary/50 p-4 text-left">
          <p className="text-sm font-semibold">Por que existe esta etapa?</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Alguns provedores de e-mail verificam links automaticamente por
            segurança. O SINA só libera o link de uso único depois que você
            solicita a confirmação.
          </p>
        </div>

        {safeTarget && (
          <Link
            to="/auth"
            className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-4"
          >
            Voltar para o acesso
          </Link>
        )}
      </section>
    </main>
  );
}
