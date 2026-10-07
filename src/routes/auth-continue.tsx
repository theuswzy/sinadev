import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
 * Legacy compatibility: older emails may still contain the complete
 * ConfirmationURL. New emails should use token_hash + verifyOtp below.
 */
function readLegacyConfirmationUrl() {
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

function validateLegacyConfirmationUrl(target: string | null) {
  if (!target) return null;

  try {
    const url = new URL(target);
    if (
      url.protocol !== "https:" ||
      !getAllowedSupabaseOrigins().has(url.origin) ||
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
      { property: "og:title", content: "Confirmar e-mail — SINA" },
      { property: "og:description", content: "Confirme seu e-mail com segurança no SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AuthContinuePage,
});

function AuthContinuePage() {
  const navigate = useNavigate();
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<string | null>(null);
  const [legacyTarget, setLegacyTarget] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTokenHash(params.get("token_hash"));
    setTokenType(params.get("type"));
    setLegacyTarget(validateLegacyConfirmationUrl(readLegacyConfirmationUrl()));
    setReady(true);
  }, []);

  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  const confirmationType = tokenType === "email" || tokenType === "signup" || tokenType === "invite"
    ? tokenType : null;
  const hasSafeTokenHash = Boolean(tokenHash && confirmationType);
  const hasSafeLegacyTarget = Boolean(legacyTarget);

  async function continueConfirmation() {
    if (started) return;

    setStarted(true);
    setError("");

    try {
      if (hasSafeTokenHash && tokenHash && confirmationType) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: confirmationType,
        });

        if (verifyError) throw verifyError;

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("token_hash");
        cleanUrl.searchParams.delete("type");
        window.history.replaceState(
          {},
          document.title,
          cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
        );

        // The /auth route already contains the centralized onboarding logic
        // for students, teachers, invited users and administrators.
        await navigate({ to: "/auth", replace: true });
        return;
      }

      if (hasSafeLegacyTarget && legacyTarget) {
        // Compatibility with already-issued confirmation emails. New emails
        // should use token_hash so the credential-bearing Supabase URL is
        // never followed by an email scanner.
        window.location.assign(legacyTarget);
        return;
      }

      throw new Error("Este link de confirmação não é válido.");
    } catch (verificationError) {
      const message =
        verificationError instanceof Error
          ? verificationError.message.toLowerCase()
          : "";

      if (
        message.includes("expired") ||
        message.includes("invalid") ||
        message.includes("otp")
      ) {
        setError(
          "Este link expirou ou já foi utilizado. Solicite um novo e-mail de confirmação no SINA.",
        );
      } else {
        setError(
          "Não foi possível confirmar seu e-mail agora. Solicite um novo e-mail de confirmação.",
        );
      }
      setStarted(false);
    }
  }

  const usable = hasSafeTokenHash || hasSafeLegacyTarget;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" />
        </div>

        <Link to="/auth" className="mt-5 inline-block font-display text-2xl font-bold">SINA</Link>

        <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Segurança SINA
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold">
          {!ready ? "Verificando seu link…" : usable ? "Confirme seu e-mail" : "Link de confirmação inválido"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {!ready ? "Aguarde enquanto o SINA verifica seu link de confirmação." : usable
            ? "Seu cadastro está quase concluído. Clique no botão abaixo para confirmar seu endereço de e-mail."
            : "Este link não pôde ser validado. Solicite um novo e-mail de confirmação no SINA."}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-sm leading-6 text-destructive"
          >
            {error}
          </div>
        )}

        {usable ? (
          <Button
            type="button"
            className="mt-7 h-11 w-full font-semibold"
            disabled={started || !ready}
            onClick={() => void continueConfirmation()}
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
          <p className="text-sm font-semibold">Proteção contra scanners</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Alguns provedores de e-mail verificam links automaticamente. O
            SINA só confirma sua conta depois de uma ação explícita sua.
          </p>
        </div>

        <Link
          to="/auth"
          className="mt-5 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          Voltar para o acesso
        </Link>
      </section>
    </main>
  );
}
