import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, LogOut, ShieldCheck, Users, LayoutDashboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { errorText } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administração — SINA" },
    { name: "description", content: "Gerencie as funções de alunos e professores no SINA." },
    { property: "og:title", content: "Administração — SINA" },
    { property: "og:description", content: "Gerencie as funções acadêmicas no SINA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
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
  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
  });
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_audit_logs", { _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
    enabled: role.data === true,
  });

  async function setAcademicRole(userId: string, nextRole: "student" | "teacher") {
    setBusyId(userId);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_academic_role", {
      _user_id: userId,
      _role: nextRole,
    });
    setBusyId(null);
    if (error) {
      setMessage(errorText(error));
      toast.error(errorText(error));
      return;
    }
    if (!data) {
      setMessage("Conta não encontrada. Atualize a página e tente novamente.");
      return;
    }
    setMessage(nextRole === "teacher" ? "Conta definida como professor." : "Conta definida como aluno.");
    toast.success(nextRole === "teacher" ? "Professor autorizado." : "Conta definida como aluno.");
    await queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
  }

  const filteredAccounts = useMemo(() => accounts.data?.filter(account => `${account.display_name} ${account.email}`.toLowerCase().includes(accountSearch.toLowerCase())) ?? [], [accounts.data, accountSearch]);
  const teacherCount = accounts.data?.filter(account => account.academic_role === "teacher").length ?? 0;

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
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-brand/95 text-brand-foreground shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-5 lg:px-8">
          <Link to="/painel" className="group flex shrink-0 items-center gap-2.5 font-display text-xl font-bold tracking-tight" aria-label="SINA — voltar ao painel">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-panel text-primary ring-1 ring-brand-border transition-transform group-hover:scale-105">
              <GraduationCap className="size-5" />
            </span>
            SINA
          </Link>
          <nav aria-label="Navegação administrativa" className="ml-2 hidden items-center rounded-xl border border-brand-border/80 bg-brand-panel/60 p-1 sm:flex">
            <Link to="/painel" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted hover:bg-brand-panel hover:text-brand-foreground">
              <LayoutDashboard className="size-4" /> Painel
            </Link>
            <span className="flex items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand-border/70">
              <ShieldCheck className="size-4 text-primary" /> Administração
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-brand-border bg-brand-panel/70 px-3 py-1.5 text-xs font-medium text-brand-muted lg:inline-flex">Controle de acesso</span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout} className="border-brand-border bg-transparent text-brand-foreground shadow-none hover:bg-brand-panel">
              <LogOut className="mr-2 size-4" /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Navegação administrativa móvel" className="flex gap-1 overflow-x-auto border-t border-brand-border/60 px-4 py-2 sm:hidden">
          <a href="#inicio" className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground"><LayoutDashboard className="size-4 text-primary" /> Visão geral</a>
          <a href="#autorizacao" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-muted hover:bg-brand-panel hover:text-brand-foreground"><Users className="size-4" /> Contas</a>
          <a href="#historico" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-muted hover:bg-brand-panel hover:text-brand-foreground"><ShieldCheck className="size-4" /> Histórico</a>
        </nav>
      </header>

      <main id="inicio" className="mx-auto max-w-6xl scroll-mt-28 space-y-6 px-5 py-7 lg:px-8 lg:py-9">
        <section className="rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck className="size-6" /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Controle de acesso</p><h1 className="mt-1 font-display text-2xl font-bold">Administração de contas</h1><p className="mt-2 max-w-2xl text-sm text-brand-muted">Defina quem acessa a área do aluno e quem pode lançar dados como professor.</p></div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sina-card sina-card-hover sina-interactive p-5"><Users className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Contas cadastradas</p><p className="mt-1 font-display text-3xl font-semibold">{accounts.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Contas no SINA</p></div>
          <div className="sina-card sina-card-hover sina-interactive p-5"><ShieldCheck className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Professores</p><p className="mt-1 font-display text-3xl font-semibold">{teacherCount}</p><p className="mt-1 text-xs text-muted-foreground">Contas autorizadas a lançar dados</p></div>
        </section>

        <section id="autorizacao" className="sina-card sina-card-hover scroll-mt-28 p-6">
          <div className="flex items-start gap-3"><Users className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Funções acadêmicas</h2><p className="mt-1 text-sm text-muted-foreground">Escolha aluno ou professor para cada conta cadastrada.</p></div></div>
          <div className="relative mt-5 max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar contas" placeholder="Buscar por nome ou e-mail" className="pl-9" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} /></div>
          {message && <p role="status" className="mt-4 text-sm">{message}</p>}
          {accounts.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando contas…</p> : accounts.error ? <p role="alert" className="mt-5 text-sm text-destructive">{errorText(accounts.error)}</p> : filteredAccounts.length ? (
            <div className="mt-5 divide-y divide-border border-t border-border">
              {filteredAccounts.map(account => (
                <div key={account.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="font-semibold">{account.display_name || account.email}</p><p className="break-all text-sm text-muted-foreground">{account.email}</p>{account.is_administrator && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><ShieldCheck className="size-3" /> Administrador</span>}</div>
                  <div className="flex shrink-0 gap-1 rounded-md border border-border p-1" aria-label={`Função acadêmica de ${account.email}`}>
                    <Button size="sm" variant={account.academic_role === "student" ? "default" : "ghost"} disabled={account.is_administrator || busyId === account.user_id} onClick={() => void setAcademicRole(account.user_id, "student")}>Aluno</Button>
                    <Button size="sm" variant={account.academic_role === "teacher" ? "default" : "ghost"} disabled={account.is_administrator || busyId === account.user_id} onClick={() => void setAcademicRole(account.user_id, "teacher")}>Professor</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-5 text-sm text-muted-foreground">{accountSearch ? "Nenhuma conta encontrada." : "Nenhuma conta cadastrada."}</p>}
        </section>

        <section id="historico" className="sina-card sina-card-hover scroll-mt-28">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="font-semibold">Histórico de alterações</h2>
              <p className="mt-1 text-sm text-muted-foreground">Registro das alterações feitas em alunos e notas.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{audit.data?.length ?? 0} registros</span>
          </div>
          {audit.isPending ? <div className="space-y-3 p-6">{[1,2,3].map(item => <div key={item} className="sina-skeleton h-12 w-full" />)}</div> : audit.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(audit.error)}</p> : audit.data?.length ? (
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

      </main>
    </div>
  );
}
