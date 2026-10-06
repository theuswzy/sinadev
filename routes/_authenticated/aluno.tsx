import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
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
  loadMyStudent,
  loadStudentAssessments,
  loadStudentAttendance,
  loadStudentCalendar,
  loadStudentSubjects,
  loadTasks,
  loadStudentTaskSubmissions,
  type Grade,
} from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Dashboard Acadêmico — SINA" },
      { name: "description", content: "Acompanhe desempenho, frequência, disciplinas e pendências acadêmicas no SINA." },
      { property: "og:title", content: "Dashboard Acadêmico — SINA" },
      { property: "og:description", content: "Acompanhamento centralizado da vida acadêmica do estudante." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StudentArea,
});

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
  const students = useQuery({ queryKey: ["my-students"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const student = students.data;
  const grades = useQuery({
    queryKey: ["grades", student?.id],
    queryFn: () => loadGrades(student?.id ?? ""),
    enabled: !!student,
    staleTime: 30_000,
  });
  const subjects = useQuery({
    queryKey: ["student-dashboard-subjects"],
    queryFn: loadStudentSubjects,
    enabled: !!student,
    staleTime: 30_000,
  });
  const tasks = useQuery({
    queryKey: ["student-dashboard-tasks"],
    queryFn: loadTasks,
    enabled: !!student,
    staleTime: 15_000,
  });
  const assessments = useQuery({
    queryKey: ["student-dashboard-assessments"],
    queryFn: loadStudentAssessments,
    enabled: !!student,
    staleTime: 30_000,
  });
  const attendanceRecords = useQuery({
    queryKey: ["student-dashboard-attendance"],
    queryFn: loadStudentAttendance,
    enabled: !!student,
    staleTime: 30_000,
  });
  const calendar = useQuery({
    queryKey: ["student-dashboard-calendar"],
    queryFn: () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 30);
      return loadStudentCalendar(from.toISOString(), to.toISOString());
    },
    enabled: !!student,
    staleTime: 30_000,
  });

  const [enrollment, setEnrollment] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("claim_student", {
        _enrollment: enrollment.trim(),
        _code: code.trim(),
      });
      if (error) throw error;
      if (!data) throw new Error("Matrícula ou código inválido, ou já vinculado.");
      setMessage("Matrícula vinculada com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["my-students"] });
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const gradeRows: Grade[] = grades.data ?? [];
  const subjectSummary = useMemo(() => {
    return Array.from(new Set(gradeRows.map((g) => g.subject))).map((subject) => {
      const rows = gradeRows.filter((g) => g.subject === subject);
      const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / rows.length : null;
      return { subject, average, absences: rows.reduce((sum, row) => sum + Number(row.absences ?? 0), 0), latest: rows.at(-1)?.score ?? null };
    });
  }, [gradeRows]);

  const stats = useMemo(() => {
    const average = gradeRows.length ? gradeRows.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / gradeRows.length : null;
    const pendingTasks = (tasks.data ?? []).filter((task) => !task.completed).length;
    const gradedAssessments = (assessments.data ?? []).filter((item) => item.score != null).length;
    const missingAssessments = (assessments.data ?? []).length - gradedAssessments;
    const absences = (attendanceRecords.data ?? []).filter((item) => item.status === "absent").length;
    const presents = (attendanceRecords.data ?? []).filter((item) => item.status === "present").length;
    const attendance = attendanceRecords.data?.length ? Math.round((presents / attendanceRecords.data.length) * 100) : student?.attendance ?? null;
    return { average, pendingTasks, gradedAssessments, missingAssessments, absences, attendance };
  }, [attendanceRecords.data, assessments.data, gradeRows, student?.attendance, tasks.data]);

  const status = stats.average == null && stats.attendance == null
    ? "Sem dados suficientes"
    : (stats.average == null || stats.average >= 7) && (stats.attendance == null || stats.attendance >= 75)
      ? "Regular"
      : "Atenção";

  const firstClass = subjects.data?.[0]?.classroom_name ?? null;
  const navigation = [
    { href: "#inicio", label: "Início", icon: LayoutDashboard },
    { href: "/aluno/disciplinas", label: "Disciplinas", icon: BookOpen },
    { href: "/aluno/notas", label: "Notas", icon: BarChart3 },
    { href: "/aluno/frequencia", label: "Frequência", icon: CheckCircle2 },
    { href: "/aluno/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/aluno/avisos", label: "Avisos", icon: ClipboardList },
  ];

  const dashboardQueries = [grades, subjects, tasks, assessments, attendanceRecords, calendar];
  const dataError = dashboardQueries.find((query) => query.error)?.error;
  const dataPending = dashboardQueries.some((query) => query.isPending);

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }

  if (role.isPending || (students.isPending && role.data === "student")) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando seu dashboard acadêmico…</div>;
  }

  if (role.error || students.error) {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive"><p role="alert">{errorText(role.error ?? students.error)}</p><Button className="mt-4" variant="outline" onClick={() => void students.refetch()}>Tentar novamente</Button></div></div>;
  }

  if (role.data === "teacher") {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm"><GraduationCap className="mx-auto size-10 text-primary" /><h1 className="mt-4 text-xl font-semibold">Área do professor</h1><p className="mt-2 text-sm text-muted-foreground">Sua conta tem acesso de professor.</p><Link to="/professor" className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">Abrir área do professor <ChevronRight className="ml-1 size-4" /></Link></div></div>;
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold"><GraduationCap className="size-7 text-primary" />SINA</Link><Button variant="ghost" onClick={logout}><LogOut className="mr-2 size-4" />Sair</Button></div></header>
        <main className="mx-auto max-w-lg px-5 py-12"><h1 className="text-2xl font-bold">Vincular minha matrícula</h1><p className="mt-2 text-sm text-muted-foreground">Peça ao professor ou administrador seu código de vinculação para liberar o acompanhamento acadêmico.</p><form onSubmit={claim} className="mt-7 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"><label className="block text-sm font-medium">Matrícula<Input className="mt-2" required value={enrollment} onChange={(e) => setEnrollment(e.target.value)} /></label><label className="block text-sm font-medium">Código de vinculação<Input className="mt-2" required value={code} onChange={(e) => setCode(e.target.value)} /></label><Button disabled={busy} type="submit" className="w-full">{busy ? "Vinculando…" : "Vincular matrícula"}</Button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card p-5 shadow-xl transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between"><Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"><GraduationCap className="size-7 text-primary" />SINA</Link><button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-5" /></button></div>
        <p className="mt-1 text-xs text-muted-foreground">Acompanhamento acadêmico</p>
        <nav className="mt-8 space-y-1" aria-label="Navegação acadêmica">{navigation.map(({ href, label, icon: Icon }, index) => <Link key={href} to={href.startsWith("/") ? href : "/aluno"} hash={href.startsWith("#") ? href.slice(1) : undefined} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${index === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="size-4" />{label}</Link>)}</nav>
        <div className="absolute inset-x-5 bottom-5 border-t border-border pt-4"><Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"><Settings className="size-4" />Configurações</Link><button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-destructive"><LogOut className="size-4" />Sair</button></div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/30 lg:hidden" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><button className="rounded-xl border border-border p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></button><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Dashboard acadêmico</p><h1 className="text-lg font-bold">Olá, {student.full_name.split(" ")[0]}!</h1></div></div><div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2"><div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></div><span className="hidden text-sm font-medium sm:block">{student.full_name}</span></div></div></header>

        <main id="inicio" className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8 lg:py-8">
          <section className="rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div><p className="text-sm font-medium text-brand-muted">Resumo acadêmico</p><h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">Sua vida acadêmica em um só lugar.</h2><div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-brand-muted"><span><strong className="text-brand-foreground">Estudante:</strong> {student.full_name}</span><span><strong className="text-brand-foreground">Turma:</strong> {firstClass ?? "Não vinculada"}</span><span><strong className="text-brand-foreground">Situação:</strong> {status}</span></div></div>
              <div className="min-w-[210px] rounded-2xl border border-brand-border bg-brand-panel/70 p-5"><div className="flex items-center justify-between text-xs text-brand-muted"><span>Dados disponíveis</span><strong className="text-brand-foreground">{gradeRows.length + (subjects.data?.length ?? 0)}</strong></div><p className="mt-2 text-xs text-brand-muted">Contagem baseada nos registros acadêmicos disponíveis. Não é um percentual de conclusão.</p></div>
            </div>
          </section>

          {dataError && <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4"><p className="text-sm text-destructive">{errorText(dataError)}</p><Button className="mt-3" variant="outline" onClick={() => void Promise.all(dashboardQueries.map((query) => query.refetch()))}>Tentar carregar novamente</Button></section>}

          <section aria-label="Indicadores acadêmicos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard title="Notas lançadas" value={String(gradeRows.length)} caption="Registros acadêmicos, não média oficial" icon={TrendingUp} />
            <DashboardCard title="Frequência" value={stats.attendance == null ? "—" : `${stats.attendance}%`} caption={attendanceRecords.data?.length ? "Calculada pelos registros disponíveis" : "Sem registros suficientes"} icon={CheckCircle2} tone="success" />
            <DashboardCard title="Atividades pendentes" value={String(stats.pendingTasks)} caption="Publicadas para sua turma" icon={ClipboardList} tone="warning" />
            <DashboardCard title="Avaliações pendentes" value={String(stats.missingAssessments)} caption="Ainda sem nota lançada" icon={AlertTriangle} tone={stats.missingAssessments ? "destructive" : "primary"} />
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Desempenho por disciplina</h2><p className="mt-1 text-sm text-muted-foreground">Resumo dos lançamentos disponíveis. A média abaixo é apenas descritiva.</p></div><Link to="/aluno/notas" className="text-sm font-semibold text-primary hover:underline">Ver notas</Link></div>
              <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Disciplina</th><th className="px-4 py-3">Média descritiva</th><th className="px-4 py-3">Faltas</th><th className="px-4 py-3">Último lançamento</th></tr></thead><tbody className="divide-y divide-border">{subjectSummary.map((item) => <tr key={item.subject}><td className="px-4 py-3 font-semibold">{item.subject}</td><td className={`px-4 py-3 font-bold ${item.average == null ? "text-muted-foreground" : scoreTone(item.average)}`}>{item.average == null ? "—" : formatScore(item.average)}</td><td className="px-4 py-3">{item.absences}</td><td className="px-4 py-3">{item.latest == null ? "—" : formatScore(Number(item.latest))}</td></tr>)}</tbody></table>{!subjectSummary.length && <p className="p-6 text-sm text-muted-foreground">Nenhum lançamento de nota disponível.</p>}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-lg font-bold">Atenção</h2><p className="mt-1 text-sm text-muted-foreground">Indicadores que merecem acompanhamento.</p><div className="mt-5 space-y-3">{stats.pendingTasks > 0 && <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-sm"><b>{stats.pendingTasks}</b> atividade(s) pendente(s).<Link to="/aluno/disciplinas" className="ml-1 text-primary underline">Acompanhar</Link></div>}{stats.missingAssessments > 0 && <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-sm"><b>{stats.missingAssessments}</b> avaliação(ões) ainda sem resultado.</div>}{stats.attendance != null && stats.attendance < 75 && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"><b>Frequência em {stats.attendance}%.</b> Consulte o histórico para entender os registros.</div>}{stats.pendingTasks === 0 && stats.missingAssessments === 0 && (stats.attendance == null || stats.attendance >= 75) && <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm">Nenhuma pendência crítica com os dados disponíveis.</div>}</div></div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Próximos eventos</h2><p className="mt-1 text-sm text-muted-foreground">Agenda dos próximos 30 dias.</p></div><CalendarDays className="size-5 text-primary" /></div><div className="mt-5 space-y-3">{(calendar.data ?? []).slice(0,5).map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="text-xs text-muted-foreground">{event.classroom_name ? `Turma ${event.classroom_name} · ` : ""}{new Date(event.start_at).toLocaleString("pt-BR")}</p></div></div>)}{!calendar.data?.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhum evento próximo cadastrado.</p>}</div><Link to="/aluno/agenda" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Abrir agenda <ChevronRight className="ml-1 size-4" /></Link></div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Atividades</h2><p className="mt-1 text-sm text-muted-foreground">Tarefas publicadas para sua turma.</p></div><ClipboardList className="size-5 text-primary" /></div><div className="mt-5 space-y-3">{(tasks.data ?? []).slice(0,5).map((task) => <div key={task.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold">{task.title}</p><span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold">{task.completed ? "Concluída" : "Pendente"}</span></div><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p></div>)}{!tasks.data?.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhuma atividade publicada.</p>}</div><Link to="/aluno/disciplinas" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">Ver atividades e disciplinas <ChevronRight className="ml-1 size-4" /></Link></div>
          </section>

          <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5"><p className="text-sm font-semibold">Como ler este painel</p><p className="mt-1 text-sm text-muted-foreground">Este dashboard é apenas um resumo. Os números vêm dos registros acadêmicos disponíveis no SINA; para detalhes de notas, frequência, avaliações e atividades, abra o módulo correspondente.</p></section>
        </main>
      </div>
    </div>
  );
}
