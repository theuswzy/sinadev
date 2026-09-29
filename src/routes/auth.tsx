import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso — SINA" }, { name: "description", content: "Entre ou crie sua conta para acessar sua área acadêmica no SINA." }, { property: "og:title", content: "Acesso — SINA" }, { property: "og:description", content: "Acesso seguro às áreas acadêmicas do SINA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AuthPage,
});

async function destination(): Promise<"/aluno" | "/professor" | "/admin"> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/aluno";
  const { data: admin } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (admin) return "/admin";
  const { data: teacher } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "teacher").maybeSingle();
  return teacher ? "/professor" : "/aluno";
}

async function navigateAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  try {
    await navigate({ to: await destination(), replace: true });
  } catch {
    // Authentication succeeded; if role lookup/navigation fails, keep the
    // authenticated user out of the login error state and use the safe area.
    await navigate({ to: "/aluno", replace: true });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) await navigateAfterAuth(navigate);
    });
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage("Se este e-mail estiver cadastrado, você receberá um link de recuperação.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } } });
        if (error) throw error;
        if (data.session) await navigateAfterAuth(navigate);
        else setMessage("Confira seu e-mail para confirmar sua conta antes de entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigateAfterAuth(navigate);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMessage("");
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }
    if (!result.redirected) await navigateAfterAuth(navigate);
  }

  return <div className="min-h-screen bg-background">
    <header className="bg-brand text-brand-foreground"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold"><GraduationCap className="size-8" /> SINA</Link><Link to="/" className="text-sm text-brand-muted hover:text-brand-foreground">Conheça o SINA</Link></div></header>
    <main className="mx-auto max-w-md px-6 py-16"><p className="text-xs font-bold uppercase text-primary">Acesso acadêmico</p><h1 className="mt-2 font-display text-3xl font-semibold">{mode === "login" ? "Entrar no SINA" : mode === "signup" ? "Criar conta" : "Recuperar senha"}</h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {mode === "signup" && <label className="block text-sm font-medium">Nome completo<Input required value={name} onChange={e => setName(e.target.value)} className="mt-2" autoComplete="name" /></label>}
        <label className="block text-sm font-medium">E-mail<Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2" autoComplete="email" /></label>
        {mode !== "forgot" && <label className="block text-sm font-medium">Senha<Input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-2" autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>}
        {message && <p role="status" className="text-sm text-foreground">{message}</p>}
        <Button disabled={busy} className="w-full" type="submit">{busy ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}</Button>
      </form>
      {mode !== "forgot" && <><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div><Button type="button" variant="outline" onClick={google} disabled={busy} className="w-full">Continuar com Google</Button></>}
      <div className="mt-6 flex flex-wrap gap-4 text-sm"><Button variant="link" className="px-0" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); }}>{mode === "signup" ? "Já tenho conta" : "Criar conta"}</Button><Button variant="link" className="px-0" onClick={() => { setMode(mode === "forgot" ? "login" : "forgot"); setMessage(""); }}>{mode === "forgot" ? "Voltar para entrar" : "Esqueci minha senha"}</Button></div>
    </main>
  </div>;
}
