import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, GraduationCap, LogOut, ShieldCheck, UserPlus, UserRoundX, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { errorText } from "@/lib/sina-data";

type TeacherAccount = { user_id: string; email: string; display_name: string; created_at: string };

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administração — SINA" },
    { name: "description", content: "Gerencie autorizações de professores no SINA." },
  ] }),
  component: AdminArea,
});

function AdminArea() {
  const queryClient = useQueryClient();
  const role = useQuery({
    queryKey: ["admin-role"],
    queryFn: async () => {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) throw new Error("Entre na sua conta para continuar.");
      const { data, error: roleError } = await supabase.rpc("is_admin", { _user_id: auth.user.id });
      if (roleError) throw roleError;
      return Boolean(data);
    },
  });
  const teachers = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async (): Promise<TeacherAccount[]> => {
      const { data, error } = await supabase.rpc("admin_list_teachers");
      if (error) throw error;
      return (data ?? []) as TeacherAccount[];
    },
    enabled: role.data === true,
  });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_audit_logs", { _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
  });

  async function setAccess(targetEmail: string, enabled: boolean) {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_teacher_access", {
      _email: targetEmail.trim(),
      _enabled: enabled,
    });
    setBusy(false);
    if (error) {
      setMessage(errorText(error));
      return;
    }
    if (!data) {
      setMessage("Conta não encontrada. O usuário precisa criar a conta no SINA antes da autorização.");
      return;
    }
    setEmail("");
    setMessage(enabled ? "Acesso de professor autorizado." : "Acesso de professor revogado.");
    await queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
  }

  async function logout() {
    await supabase.auth.signOut();
    void queryClient.clear();
  }

  if (role.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Verificando permissões…</div>;
  }

  if (role.error || !role.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Acesso administrativo restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta área só pode ser acessada por contas com a função de administrador.</p>
          <Link to="/painel" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Voltar ao painel</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-brand-border bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold"><GraduationCap className="size-8" />SINA</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/painel" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-muted hover:bg-brand-panel hover:text-brand-foreground"><LayoutDashboard className="size-4" />Painel</Link>
            <Button variant="outline" size="sm" onClick={logout} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel"><LogOut className="mr-2 size-4" />Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-7 lg:px-8 lg:py-9">
        <section className="rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck className="size-6" /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Controle de acesso</p><h1 className="mt-1 font-display text-2xl font-bold">Administração de professores</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Autorize ou revogue quem pode acessar a área de professores e lançar dados acadêmicos.</p></div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><Users className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Professores autorizados</p><p className="mt-1 font-display text-3xl font-semibold">{teachers.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Contas com acesso ativo</p></div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><ShieldCheck className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Controle de acesso</p><p className="mt-1 text-sm font-semibold">Permissões centralizadas</p><p className="mt-1 text-xs text-muted-foreground">Autorize ou revogue professores pelo painel.</p></div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3"><UserPlus className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Autorizar professor</h2><p className="mt-1 text-sm text-muted-foreground">Informe o e-mail de uma conta já cadastrada no SINA.</p></div></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input type="email" placeholder="professor@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button disabled={busy || !email.trim()} onClick={() => void setAccess(email, true)} className="sm:w-48"><CheckCircle2 className="mr-2 size-4" />Autorizar</Button>
          </div>
          {message && <p role="status" className="mt-4 text-sm">{message}</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="font-semibold">Histórico de alterações</h2>
              <p className="mt-1 text-sm text-muted-foreground">Registro das alterações feitas em alunos e notas.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{audit.data?.length ?? 0} registros</span>
          </div>
          {audit.isPending ? <p className="p-6 text-sm text-muted-foreground">Carregando histórico…</p> : audit.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(audit.error)}</p> : audit.data?.length ? (
            <div className="divide-y divide-border">
              {audit.data.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{entry.action} · {entry.table_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Registro {entry.record_id ?? "—"}</p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("pt-BR")}</time>
                </div>
              ))}
            </div>
          ) : <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-6"><div className="flex items-center gap-3"><Users className="size-5 text-primary" /><div><h2 className="font-semibold">Contas autorizadas</h2><p className="mt-1 text-sm text-muted-foreground">Contas que atualmente possuem permissão para lançar dados acadêmicos.</p></div></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{teachers.data?.length ?? 0} professor(es)</span></div>
          {teachers.isPending ? <p className="p-6 text-sm text-muted-foreground">Carregando permissões…</p> : teachers.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(teachers.error)}</p> : teachers.data?.length ? (
            <div className="divide-y divide-border">
              {teachers.data.map((teacher) => (
                <div key={teacher.user_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="font-semibold">{teacher.display_name || "Sem nome informado"}</p><p className="mt-1 truncate text-sm text-muted-foreground">{teacher.email}</p></div>
                  <Button variant="outline" disabled={busy} onClick={() => void setAccess(teacher.email, false)} className="w-full text-destructive hover:text-destructive sm:w-auto"><UserRoundX className="mr-2 size-4" />Revogar acesso</Button>
                </div>
              ))}
            </div>
          ) : <div className="p-8 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhum professor autorizado.</p><p className="mt-1 text-xs text-muted-foreground">Use o campo acima para liberar uma conta.</p></div>}
        </section>
      </main>
    </div>
  );
}
