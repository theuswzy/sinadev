import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/reset-password")({ head: () => ({ meta: [{ title: "Nova senha — SINA" }, { name: "description", content: "Defina uma nova senha para sua conta SINA." }, { property: "og:title", content: "Nova senha — SINA" }, { property: "og:description", content: "Recuperação de acesso ao SINA." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ResetPassword });
function ResetPassword() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recovery = hash.get("type") === "recovery";
    if (recovery) setValid(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setValid(true); });
    return () => subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setMessage(error?.message ?? "Senha atualizada. Você já pode entrar."); setBusy(false); }
  return <main className="mx-auto max-w-md px-6 py-16"><Link to="/" className="font-display text-2xl font-bold text-primary">SINA</Link><h1 className="mt-10 text-3xl font-semibold">Nova senha</h1>{valid ? <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">Nova senha<Input className="mt-2" type="password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label><Button type="submit" disabled={busy}>Salvar nova senha</Button></form> : <p className="mt-5 text-muted-foreground">Abra o link de recuperação recebido por e-mail para continuar.</p>}{message && <p role="status" className="mt-5 text-sm">{message}</p>}<p className="mt-6"><Link to="/auth" className="text-sm text-primary underline">Voltar ao acesso</Link></p></main>;
}
