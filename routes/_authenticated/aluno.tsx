import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  errorText,
  formatScore,
  getRole,
  loadGrades,
  loadStudents,
  type Grade,
  type Student,
} from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Dashboard Acadêmico — SINA" },
      { name: "description", content: "Acompanhe desempenho, frequência, disciplinas, calendário e pendências acadêmicas no SINA." },
      { property: "og:title", content: "Dashboard Acadêmico — SINA" },
      { property: "og:description", content: "Acompanhamento centralizado da vida acadêmica do estudante." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StudentArea,
});

const demoSubjects = [
  { name: "Fundamentos do Curso", teacher: "Prof. disponível no sistema", workload: "60h", period: "2026.2" },
  { name: "Práticas Profissionais", teacher: "Prof. disponível no sistema", workload: "80h", period: "2026.2" },
  { name: "Gestão e Processos", teacher: "Prof. disponível no sistema", workload: "60h", period: "2026.2" },
  { name: "Projeto Integrador", teacher: "Prof. disponível no sistema", workload: "40h", period: "2026.2" },
];

const calendarItems = [
  { date: "05 OUT", type: "Prova", title: "Avaliação do próximo módulo", tone: "warning" },
  { date: "10 OUT", type: "Trabalho", title: "Entrega do projeto integrador", tone: "primary" },
  { date: "18 OUT", type: "Atividade", title: "Atividade complementar", tone: "success" },
];

const history = [
  { period: "2026.2", status: "Em andamento", progress: 72 },
  { period: "2026.1", status: "Concluído", progress: 100 },
  { period: "2025.2", status: "Concluído", progress: 100 },
];

function scoreTone(score: number) {
  if (score >= 7) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-destructive";
}

function DashboardCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  caption: string;
  icon: typeof TrendingUp;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function StudentArea() {
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const students = useQuery({ queryKey: ["my-students"], queryFn: loadStudents, enabled: role.data === "student" });
  const student = students.data?.[0];
  const grades = useQuery({
    queryKey: ["grades", student?.id],
    queryFn: () => loadGrades(student?.id ?? ""),
    enabled: !!student,
  });

  const [enrollment, setEnrollment] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("claim_student", {
      _enrollment: enrollment.trim(),
      _code: code.trim(),
    });
    setBusy(false);
    if (error || !data) {
      setMessage(error ? errorText(error) : "Matrícula ou código inválido, ou já vinculado.");
      return;
    }
    setMessage("Matrícula vinculada com sucesso.");
    await queryClient.invalidateQueries({ queryKey: ["my-students"] });
  }

  const stats = useMemo(() => {
    const rows = grades.data ?? [];
    const average = rows.length ? rows.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / rows.length : 0;
    const subjects = new Set(rows.map((item) => item.subject));
    const completed = rows.filter((item) => Number(item.score ?? 0) >= 7).length;
    const pending = rows.filter((item) => Number(item.score ?? 0) < 5).length;
    return {
      average,
      subjects: subjects.size,
      completed,
      pending,
      progress: subjects.size ? Math.min(100, Math.round((completed / Math.max(subjects.size, 1)) * 100)) : 0,
    };
  }, [grades.data]);

  const attendance = student?.attendance ?? 0;
  const status = stats.average >= 7 && attendance >= 75 ? "Regular" : stats.average >= 5 ? "Atenção" : "Necessita acompanhamento";

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }

  const navigation = [
    { href: "#inicio", label: "Início", icon: LayoutDashboard },
    { href: "#disciplinas", label: "Disciplinas", icon: BookOpen },
    { href: "#desempenho", label: "Desempenho", icon: BarChart3 },
    { href: "#calendario", label: "Calendário", icon: CalendarDays },
    { href: "#pendencias", label: "Pendências", icon: AlertTriangle },
    { href: "#historico", label: "Histórico", icon: TrendingUp },
  ];

  if (role.isPending || (students.isPending && role.data === "student")) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando seu dashboard acadêmico…</div>;
  }

  if (role.error || students.error) {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">{errorText(role.error ?? students.error)}</p></div>;
  }

  if (role.data === "teacher") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <GraduationCap className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">Área do professor</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sua conta tem acesso de professor.</p>
          <Link to="/professor" className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">Abrir área do professor <ChevronRight className="ml-1 size-4" /></Link>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold"><GraduationCap className="size-7 text-primary" />SINA</Link>
            <Button variant="ghost" onClick={logout}><LogOut className="mr-2 size-4" />Sair</Button>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-5 py-12">
          <h1 className="text-2xl font-bold">Vincular minha matrícula</h1>
          <p className="mt-2 text-sm text-muted-foreground">Peça ao professor seu código de vinculação para liberar o acompanhamento acadêmico.</p>
          <form onSubmit={claim} className="mt-7 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <label className="block text-sm font-medium">Matrícula<Input className="mt-2" required value={enrollment} onChange={(e) => setEnrollment(e.target.value)} /></label>
            <label className="block text-sm font-medium">Código de vinculação<Input className="mt-2" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <Button disabled={busy} type="submit" className="w-full">{busy ? "Vinculando…" : "Vincular matrícula"}</Button>
            {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
          </form>
        </main>
      </div>
    );
  }

  const gradeRows: Grade[] = grades.data ?? [];
  const groupedSubjects = Array.from(new Map(gradeRows.map((g) => [g.subject, g])).values());

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card p-5 shadow-xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"><GraduationCap className="size-7 text-primary" />SINA</Link>
          <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-5" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Acompanhamento acadêmico</p>
        <nav className="mt-8 space-y-1" aria-label="Navegação acadêmica">
          {navigation.map(({ href, label, icon: Icon }, index) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${index === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <Icon className="size-4" />{label}
            </a>
          ))}
        </nav>
        <div className="absolute inset-x-5 bottom-5 border-t border-border pt-4">
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"><Settings className="size-4" />Configurações</Link>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-destructive"><LogOut className="size-4" />Sair</button>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/30 lg:hidden" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button className="rounded-xl border border-border p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Dashboard</p><h1 className="text-lg font-bold">Olá, {student.full_name.split(" ")[0]}!</h1></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></div>
              <span className="hidden text-sm font-medium sm:block">{student.full_name}</span>
            </div>
          </div>
        </header>

        <main id="inicio" className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8 lg:py-8">
          <section className="rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="text-sm font-medium text-brand-muted">Resumo acadêmico</p>
                <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">Sua vida acadêmica em um só lugar.</h2>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-brand-muted">
                  <span><strong className="text-brand-foreground">Estudante:</strong> {student.full_name}</span>
                  <span><strong className="text-brand-foreground">Curso:</strong> PROSUB</span>
                  <span><strong className="text-brand-foreground">Período:</strong> 2026.2</span>
                  <span><strong className="text-brand-foreground">Situação:</strong> {status}</span>
                </div>
              </div>
              <div className="min-w-[210px] rounded-2xl border border-brand-border bg-brand-panel/70 p-5">
                <div className="flex items-center justify-between text-xs text-brand-muted"><span>Progresso geral</span><strong className="text-brand-foreground">{stats.progress}%</strong></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-border"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${stats.progress}%` }} /></div>
                <p className="mt-2 text-xs text-brand-muted">Baseado nas avaliações registradas</p>
              </div>
            </div>
          </section>

          <section aria-label="Indicadores acadêmicos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard title="Média geral" value={stats.average ? formatScore(stats.average) : "—"} caption="Escala de 0 a 10" icon={TrendingUp} />
            <DashboardCard title="Frequência" value={student.attendance === null ? "—" : `${formatScore(attendance)}%`} caption="Frequência registrada" icon={CheckCircle2} tone="success" />
            <DashboardCard title="Disciplinas" value={String(stats.subjects)} caption={`${stats.completed} concluída(s) · ${stats.pending} pendente(s)`} icon={BookOpen} tone="warning" />
            <DashboardCard title="Carga horária" value={`${stats.subjects * 60}h`} caption="Estimativa inicial demonstrativa" icon={Clock3} />
          </section>

          <section id="desempenho" className="grid gap-6 xl:grid-cols-5">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-3">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Evolução das notas</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhamento do desempenho por período</p></div><span className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="size-4" /></span></div>
              <div className="mt-7">
                <svg viewBox="0 0 640 220" className="h-56 w-full" role="img" aria-label="Gráfico de evolução das notas">
                  <path d="M20 190H620M20 140H620M20 90H620M20 40H620" stroke="currentColor" className="text-border" strokeWidth="1" />
                  <polyline fill="none" stroke="currentColor" className="text-primary" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points="30,160 180,135 330,112 480,82 610,55" />
                  {[["30","160"],["180","135"],["330","112"],["480","82"],["610","55"]].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="6" fill="currentColor" className="text-primary" />)}
                  <text x="30" y="212" className="fill-current text-xs text-muted-foreground">1º bim.</text><text x="170" y="212" className="fill-current text-xs text-muted-foreground">2º bim.</text><text x="320" y="212" className="fill-current text-xs text-muted-foreground">3º bim.</text><text x="470" y="212" className="fill-current text-xs text-muted-foreground">4º bim.</text><text x="585" y="212" className="fill-current text-xs text-muted-foreground">Atual</text>
                </svg>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
              <h2 className="text-lg font-bold">Frequência</h2><p className="mt-1 text-sm text-muted-foreground">Indicador de presença acadêmica</p>
              <div className="mt-7 flex items-center gap-6">
                <div className="relative flex size-36 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${attendance}%, hsl(var(--secondary)) 0)` }}>
                  <div className="flex size-28 flex-col items-center justify-center rounded-full bg-card"><span className="text-2xl font-bold">{student.attendance === null ? "—" : `${Math.round(attendance)}%`}</span><span className="text-[11px] text-muted-foreground">presença</span></div>
                </div>
                <div className="space-y-3 text-sm"><p><span className="font-semibold">Situação:</span> {attendance >= 75 ? "Regular" : "Atenção"}</p><p className="text-muted-foreground">Mantenha sua frequência acompanhando as próximas atividades.</p></div>
              </div>
            </div>
          </section>

          <section id="disciplinas" className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6"><div><h2 className="text-lg font-bold">Disciplinas atuais</h2><p className="mt-1 text-sm text-muted-foreground">Notas, frequência, carga horária e situação</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{groupedSubjects.length || demoSubjects.length} disciplinas</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3">Disciplina</th><th className="px-4 py-3">Nota</th><th className="px-4 py-3">Frequência</th><th className="px-4 py-3">Carga</th><th className="px-4 py-3">Professor</th><th className="px-6 py-3">Situação</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {(groupedSubjects.length ? groupedSubjects.map((g) => ({ name: g.subject, score: Number(g.score ?? 0), absences: g.absences, workload: "60h", teacher: "Disponível no sistema", status: Number(g.score ?? 0) >= 7 ? "Concluída" : Number(g.score ?? 0) >= 5 ? "Em andamento" : "Atenção" })) : demoSubjects.map((g) => ({ name: g.name, score: 0, absences: 0, workload: g.workload, teacher: g.teacher, status: "Dados demonstrativos" }))).map((item) => (
                    <tr key={item.name} className="transition-colors hover:bg-muted/40"><td className="px-6 py-4 font-semibold">{item.name}</td><td className={`px-4 py-4 font-bold tabular-nums ${item.score ? scoreTone(item.score) : "text-muted-foreground"}`}>{item.score ? formatScore(item.score) : "—"}</td><td className="px-4 py-4">{item.absences} faltas</td><td className="px-4 py-4">{item.workload}</td><td className="px-4 py-4 text-muted-foreground">{item.teacher}</td><td className="px-6 py-4"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{item.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div id="calendario" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Calendário acadêmico</h2><p className="mt-1 text-sm text-muted-foreground">Próximos compromissos</p></div><CalendarDays className="size-5 text-primary" /></div>
              <div className="mt-5 space-y-3">{calendarItems.map((item) => <div key={item.date} className="flex items-center gap-4 rounded-xl border border-border p-4"><div className="w-14 shrink-0 rounded-lg bg-muted p-2 text-center text-[10px] font-bold">{item.date}</div><div className="min-w-0"><p className="text-xs font-semibold text-primary">{item.type}</p><p className="truncate text-sm font-medium">{item.title}</p></div><ChevronRight className="ml-auto size-4 text-muted-foreground" /></div>)}</div>
            </div>
            <div id="pendencias" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Pendências</h2><p className="mt-1 text-sm text-muted-foreground">O que merece sua atenção</p></div><AlertTriangle className="size-5 text-warning" /></div>
              <div className="mt-5 space-y-3">
                {stats.pending > 0 ? <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" /><div><p className="text-sm font-semibold">Há disciplinas com desempenho abaixo do esperado.</p><p className="mt-1 text-xs text-muted-foreground">Consulte a área de disciplinas e acompanhe as próximas avaliações.</p></div></div> : <div className="flex gap-3 rounded-xl border border-success/20 bg-success/5 p-4"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /><div><p className="text-sm font-semibold">Nenhuma pendência crítica identificada.</p><p className="mt-1 text-xs text-muted-foreground">Continue acompanhando seus prazos e avaliações.</p></div></div>}
                {attendance < 75 && <div className="flex gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="text-sm font-semibold">Atenção à frequência.</p><p className="mt-1 text-xs text-muted-foreground">Acompanhe sua presença nas próximas atividades.</p></div></div>}
              </div>
            </div>
          </section>

          <section id="historico" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div><h2 className="text-lg font-bold">Histórico acadêmico</h2><p className="mt-1 text-sm text-muted-foreground">Trajetória do estudante por período</p></div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">{history.map((item) => <div key={item.period} className="rounded-xl border border-border p-5"><div className="flex items-center justify-between"><span className="font-bold">{item.period}</span><span className="text-xs font-semibold text-muted-foreground">{item.status}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{item.progress}% do período acompanhado</p></div>)}</div>
          </section>

          <footer className="flex flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>SINA — Sistema Digital para Acompanhamento de Dados Acadêmicos</span><span>Dados demonstrativos podem ser substituídos por dados acadêmicos reais.</span></footer>
        </main>
      </div>
    </div>
  );
}
