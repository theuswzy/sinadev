import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-messages";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — SINA" },
      { name: "description", content: "Defina uma nova senha para sua conta SINA." },
      { property: "og:title", content: "Nova senha — SINA" },
      { property: "og:description", content: "Recuperação de acesso ao SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ResetPassword,
});

function readRedirectError() {
  const url = new URL(window.location.href);
  const params = new URLSearchParams();

  url.searchParams.forEach((value, key) => params.set(key, value));
  new URLSearchParams(url.hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));

  const error = params.get("error_description") || params.get("error");
  if (!error) return null;

  return new Error(error);
}

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function ResetPassword() {
  const navigate = useNavigate();
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const code = url.searchParams.get("code");
    const recoveryInUrl =
      hash.get("type") === "recovery" ||
      url.searchParams.get("type") === "recovery";

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setValid(true);
        setBusy(false);
      }
    });

    async function initializeRecovery() {
      try {
        const redirectError = readRedirectError();
        if (redirectError) throw redirectError;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setValid(true);
        } else if (recoveryInUrl) {
          // Implicit-flow recovery links contain the session in the hash.
          // Supabase initializes that session automatically.
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            throw new Error("O link de recuperação não criou uma sessão válida.");
          }
          setValid(true);
        } else {
          // The PASSWORD_RECOVERY event may arrive asynchronously after the
          // component mounts, so give the auth client a chance to finish URL
          // initialization before deciding that the link is missing.
          await supabase.auth.getSession();
        }

        if (!cancelled) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          cleanUrl.searchParams.delete("type");
          cleanUrl.searchParams.delete("error");
          cleanUrl.searchParams.delete("error_code");
          cleanUrl.searchParams.delete("error_description");
          cleanUrl.hash = "";
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
          setBusy(false);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(authErrorMessage(error, "recovery"));
          setBusy(false);
        }
      }
    }

    void initializeRecovery();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const checks = passwordChecks(password);
    if (!checks.length || !checks.upper || !checks.lower || !checks.number || !checks.special) {
      setMessage("Crie uma senha com pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setUpdated(true);
      setMessage("Senha atualizada com sucesso. Agora entre novamente no SINA.");
    } catch (error) {
      setMessage(authErrorMessage(error, "recovery"));
    } finally {
      setBusy(false);
    }
  }

  if (updated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold">Senha alterada</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sua senha foi atualizada. Use a nova senha para entrar no SINA.
          </p>
          <Button className="mt-7 h-11 w-full" onClick={() => void navigate({ to: "/auth", replace: true })}>
            Entrar no SINA <ArrowRight />
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-8">
        <Link to="/auth" className="font-display text-2xl font-bold text-primary">SINA</Link>

        <div className="mt-10">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold">Criar nova senha</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Escolha uma nova senha para recuperar o acesso à sua conta.
          </p>
        </div>

        {busy && !valid ? (
          <div className="mt-7 rounded-2xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
            Validando seu link de recuperação…
          </div>
        ) : valid ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-sm font-medium">
              Nova senha
              <Input
                className="mt-2 h-11"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium">
              Confirmar nova senha
              <Input
                className="mt-2 h-11"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>

            <p className="text-xs leading-5 text-muted-foreground">
              Use pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial.
            </p>

            <Button type="submit" disabled={busy} className="h-11 w-full font-semibold">
              {busy ? "Salvando…" : "Salvar nova senha"} <ArrowRight />
            </Button>
          </form>
        ) : (
          <div role="alert" className="mt-7 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
            {message || "Abra o link de recuperação recebido por e-mail para continuar."}
          </div>
        )}

        {message && valid && (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/60 p-4 text-sm leading-6" role="status">
            {message}
          </div>
        )}

        <p className="mt-6">
          <Link to="/auth" className="text-sm font-semibold text-primary underline underline-offset-4">
            Voltar ao acesso
          </Link>
        </p>
      </section>
    </main>
  );
}
