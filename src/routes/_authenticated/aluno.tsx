import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, CalendarDays, CircleAlert, TrendingUp, UserRound, Megaphone, ClipboardCheck, Clock3, CheckCircle2, ArrowUpRight } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadMyStudent, loadAnnouncements, loadTasks, setTaskCompleted } from "@/lib/sina-data";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Dashboard do aluno — SINA" },
      { name: "description", content: "Acompanhe seu desempenho acadêmico no SINA." },
      { property: "og:title", content: "Dashboard do aluno — SINA" },
      { property: "og:description", content: "Acompanhe seu desempenho acadêmico no SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentArea,
});

function StudentArea() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({
    queryKey: ["my-student"],
    queryFn: loadMyStudent,
    enabled: role.data === "student",
    refetchOnWindowFocus: true,
  });
  const announcements = useQuery({
    queryKey: ["my-announcements", student.data?.classroom],
    queryFn: loadAnnouncements,
    enabled: !!student.data?.id,
    refetchOnWindowFocus: true,
  });
  const tasks = useQuery({
    queryKey: ["my-tasks", student.data?.classroom],
    queryFn: loadTasks,
    enabled: !!student.data?.id,
    refetchOnWindowFocus: true,
  });
  const grades = useQuery({
    queryKey: ["my-grades", student.data?.id],
    queryFn: () => loadGrades(student.data?.id ?? ""),
    enabled: !!student.data?.id,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!student.data?.id) return;

    const channel = supabase
      .channel(`student-academic-${student.data.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "students",
          filter: `id=eq.${student.data.id}`,
        },
        () => {
          void student.refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grades",
          filter: `student_id=eq.${student.data.id}`,
        },
        () => {
          void grades.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => { void announcements.refetch(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => { void tasks.refetch(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_completions" },
        () => { void tasks.refetch(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [student.data?.id, student.refetch, grades.refetch, announcements.refetch, tasks.refetch]);

  const average = grades.data?.length
    ? grades.data.reduce((sum, grade) => sum + grade.score, 0) / grades.data.length
    : 0;
  const totalAbsences = grades.data?.reduce((sum, grade) => sum + grade.absences, 0) ?? 0;
  const linked = Boolean(student.data?.teacher_id && student.data?.enrollment && student.data?.classroom);
  const pendingTasks = tasks.data?.filter(task => !task.completed).length ?? 0;
  const recentAnnouncements = announcements.data?.slice(0, 3) ?? [];
  const recentTasks = tasks.data?.filter(task => !task.completed).slice(0, 4) ?? [];
  const subjectPerformance = Array.from(new Set(grades.data?.map(g => g.subject) ?? [])).map(subject => {
    const items = grades.data?.filter(g => g.subject === subject) ?? [];
    return { subject, average: items.reduce((sum, item) => sum + item.score, 0) / items.length, absences: items.reduce((sum, item) => sum + item.absences, 0), periods: items.length };
  }).sort((a, b) => b.average - a.average);
  const topSubjects = subjectPerformance.slice(0, 4);

  async function toggleTask(taskId: string) {
    try {
      await setTaskCompleted(taskId, true);
      await tasks.refetch();
      toast.success("Tarefa marcada como concluída.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (role.isPending || student.isPending) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento">
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Carregando dashboard">
        {[1, 2, 3, 4].map((item) => <div key={item} className="sina-card p-5"><div className="sina-skeleton size-8" /><div className="sina-skeleton mt-5 h-3 w-24" /><div className="sina-skeleton mt-3 h-8 w-16" /><div className="sina-skeleton mt-3 h-3 w-32" /></div>)}
      </div>
    </AcademicShell>;
  }

  if (role.error || student.error) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento"><p role="alert" className="mt-8 text-destructive">{errorText(role.error ?? student.error)}</p></AcademicShell>;
  }

  if (role.data === "teacher") {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Área do professor"><p className="mt-8">Sua conta possui acesso de professor. <Link to="/professor" className="text-primary underline">Abrir área do professor</Link>.</p></AcademicShell>;
  }

  if (role.data === "admin") {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Área administrativa"><p className="mt-8">Sua conta possui acesso administrativo. <Link to="/admin" className="text-primary underline">Abrir área administrativa</Link>.</p></AcademicShell>;
  }

  if (!student.data) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento">
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Não encontramos seu perfil de aluno</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sua conta está autenticada, mas o perfil acadêmico ainda não foi criado. Tente atualizar agora.</p>
        <Button type="button" className="mt-4" onClick={() => void student.refetch()} disabled={student.isFetching}>
          {student.isFetching ? "Atualizando…" : "Tentar novamente"}
        </Button>
      </div>
    </AcademicShell>;
  }

  return (
    <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento">
      <section id="inicio" className="mt-8 scroll-mt-28 overflow-hidden rounded-3xl border border-brand-border bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-panel">
              {student.data.avatar_url ? <img src={student.data.avatar_url} alt="" className="size-full object-cover" /> : <UserRound className="size-7 text-brand-muted" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Área do aluno</p>
              <h2 className="mt-1 font-display text-3xl font-bold">Olá, {student.data.full_name.split(" ")[0]}! 👋</h2>
              <p className="mt-1 text-sm text-brand-muted">Bem-vindo ao SINA. Acompanhe sua vida acadêmica de forma simples e organizada.</p>
            </div>
          </div>
          <Link to="/aluno/perfil" className="inline-flex items-center gap-2 self-start rounded-xl border border-brand-border bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-panel hover:text-brand-foreground md:self-center"><UserRound /> Meu perfil</Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-brand-muted">
          <span className="rounded-full border border-brand-border bg-brand-panel px-3 py-1.5">{linked ? `Turma ${student.data.classroom}` : "Cadastro em andamento"}</span>
          {student.data.enrollment && <span className="rounded-full border border-brand-border bg-brand-panel px-3 py-1.5">Matrícula {student.data.enrollment}</span>}
          <span className="rounded-full border border-brand-border bg-brand-panel px-3 py-1.5">{linked ? "Dados atualizados automaticamente" : "Aguardando vínculo acadêmico"}</span>
        </div>
      </section>

      {!linked && (
        <section className="mt-5 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleAlert className="size-5" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Primeiro acesso</p>
                <h2 className="mt-1 font-semibold">Seu espaço no SINA está pronto.</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Sua conta já está funcionando. Falta apenas o vínculo com sua turma e matrícula para que os dados acadêmicos sejam preenchidos.</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-primary/20 bg-background/60 px-3 py-1.5 text-xs font-semibold text-primary">1 de 3 etapas</span>
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-card/70 p-3"><p className="text-xs font-bold text-primary">✓ 01</p><p className="mt-1 text-sm font-semibold">Conta criada</p></div>
            <div className="rounded-xl border border-primary/20 bg-card/70 p-3"><p className="text-xs font-bold text-primary">○ 02</p><p className="mt-1 text-sm font-semibold">Vínculo com turma</p></div>
            <div className="rounded-xl border border-border bg-card/40 p-3"><p className="text-xs font-bold text-muted-foreground">○ 03</p><p className="mt-1 text-sm font-semibold text-muted-foreground">Dados acadêmicos</p></div>
          </div>
        </section>
      )}

      <section id="tarefas" className="mt-5 scroll-mt-28 grid gap-4 lg:grid-cols-3">
        <div className="sina-card sina-card-hover sina-interactive p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Megaphone className="size-5" /></div><div><p className="text-xs font-bold uppercase text-muted-foreground">Avisos</p><p className="text-lg font-semibold">{recentAnnouncements.length ? "Novidades da turma" : "Quadro de avisos"}</p></div></div>
          {recentAnnouncements.length ? <div className="mt-4 space-y-3">{recentAnnouncements.map(a => <div key={a.id} className="rounded-xl bg-secondary/50 p-3"><p className="text-sm font-semibold">{a.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">{linked ? "Os avisos publicados pelos professores aparecerão aqui." : "Os avisos aparecerão aqui quando você estiver vinculado a uma turma."}</p>}
        </div>
        <div className="sina-card sina-card-hover sina-interactive p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ClipboardCheck className="size-5" /></div><div><p className="text-xs font-bold uppercase text-muted-foreground">Tarefas pendentes</p><p className="text-lg font-semibold">{pendingTasks ? pendingTasks + " pendente" + (pendingTasks === 1 ? "" : "s") : "Nenhuma pendência"}</p></div></div>
          {recentTasks.length ? <div className="mt-4 space-y-3">{recentTasks.map(task => <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/50 p-3"><div><p className="text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject}{task.due_at ? " · Entrega " + new Date(task.due_at).toLocaleDateString("pt-BR") : ""}</p></div><Button type="button" size="sm" variant="outline" onClick={() => void toggleTask(task.id)}>Concluir</Button></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">{linked ? "As tarefas recebidas dos professores aparecerão aqui." : "Suas tarefas aparecerão aqui após o vínculo acadêmico."}</p>}
        </div>
        <div className="sina-card sina-card-hover sina-interactive p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Clock3 className="size-5" /></div><div><p className="text-xs font-bold uppercase text-muted-foreground">Frequência</p><p className="text-lg font-semibold">{student.data.attendance === null ? "Aguardando dados" : formatScore(student.data.attendance) + "%"}</p></div></div>
          <p className="mt-4 text-sm text-muted-foreground">{linked ? "Acompanhe sua frequência e faltas registradas." : "A frequência será preenchida quando houver vínculo acadêmico."}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary"><CheckCircle2 className="size-4" /> {totalAbsences} {totalAbsences === 1 ? "falta registrada" : "faltas registradas"}</div>
        </div>
      </section>

      <section aria-label="Resumo acadêmico" className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Visão rápida</p>
            <h2 className="mt-1 text-lg font-semibold">Resumo acadêmico</h2>
          </div>
          <span className="text-xs text-muted-foreground">Seus principais indicadores</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Média geral", value: average ? formatScore(average) : "—", note: linked ? "Escala de 0 a 10" : "Aguardando notas", Icon: TrendingUp },
          { label: "Frequência", value: student.data.attendance === null ? "—" : `${formatScore(student.data.attendance)}%`, note: linked ? "Frequência registrada" : "Aguardando dados", Icon: CalendarDays },
          { label: "Tarefas pendentes", value: String(pendingTasks), note: pendingTasks ? "Aguardando sua ação" : "Tudo em dia", Icon: ClipboardCheck },
          { label: "Disciplinas", value: String(new Set(grades.data?.map(g => g.subject) ?? []).size), note: "Matérias cadastradas", Icon: GraduationCap },
        ].map(({ label, value, note, Icon }) => (
          <div key={label} className="sina-card sina-card-hover sina-interactive p-5">
            <Icon className="size-5 text-primary" />
            <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
        </div>
      </section>

      <section className="mt-5 sina-card sina-card-hover p-6">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Desempenho por disciplina</h2><p className="mt-1 text-sm text-muted-foreground">Uma visão rápida das médias e faltas em cada matéria.</p></div><ArrowUpRight className="size-5 text-primary" /></div>
        {topSubjects.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{topSubjects.map(item => <div key={item.subject} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.subject}</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{formatScore(item.average)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.average * 10)}%` }} /></div><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{item.periods} lançamento{item.periods === 1 ? "" : "s"}</span><span>{item.absences} falta{item.absences === 1 ? "" : "s"}</span></div></div>)}</div> : <div className="mt-5 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">As médias por disciplina aparecerão aqui quando houver notas lançadas.</div>}
      </section>

      <section id="disciplinas" className="mt-5 scroll-mt-28">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Área acadêmica</p><h2 className="mt-1 text-lg font-semibold">Minhas disciplinas</h2><p className="mt-1 text-sm text-muted-foreground">Veja o desempenho de cada disciplina em um único lugar.</p></div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{subjectPerformance.length} disciplina{subjectPerformance.length === 1 ? "" : "s"}</span>
        </div>
        {subjectPerformance.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{subjectPerformance.map(item => <article key={item.subject} className="sina-card sina-card-hover sina-interactive p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-muted-foreground">Disciplina</p><h3 className="mt-1 truncate font-semibold">{item.subject}</h3></div><div className="rounded-xl bg-primary/10 px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase text-primary">Média</p><p className="font-display text-xl font-bold text-primary">{formatScore(item.average)}</p></div></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.average * 10)}%` }} /></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-secondary/50 p-3"><p className="text-muted-foreground">Lançamentos</p><p className="mt-1 font-semibold">{item.periods}</p></div><div className="rounded-xl bg-secondary/50 p-3"><p className="text-muted-foreground">Faltas</p><p className="mt-1 font-semibold">{item.absences}</p></div></div>
          <p className="mt-4 text-xs text-muted-foreground">Acompanhe suas notas e faltas na tabela acadêmica abaixo.</p>
        </article>)}</div> : <div className="sina-card p-6 text-sm text-muted-foreground">Suas disciplinas aparecerão aqui assim que houver lançamentos acadêmicos.</div>}
      </section>

      <section id="notas" className="mt-5 overflow-hidden scroll-mt-28 sina-card sina-card-hover">
        <div className="border-b border-border p-6"><h2 className="text-lg font-semibold">Minhas matérias e notas</h2><p className="mt-1 text-xs text-muted-foreground">{linked ? "Dados vinculados à sua matrícula." : "A área já está disponível; os dados serão preenchidos após o vínculo."}</p></div>
        {grades.isPending ? <p className="p-6 text-sm text-muted-foreground">Carregando seus dados…</p> : grades.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(grades.error)}</p> : grades.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-4">Disciplina</th><th className="p-4">Período</th><th className="p-4">Nota</th><th className="p-4">Faltas</th><th className="p-4">Situação</th></tr></thead><tbody>{grades.data.map(g => <tr key={g.id} className="border-b border-border"><td className="p-4 font-medium">{g.subject}</td><td className="p-4">{g.period}º</td><td className="p-4 font-semibold tabular-nums">{formatScore(g.score)}</td><td className="p-4 tabular-nums">{g.absences}</td><td className="p-4">{g.score >= 7 ? "Concluída" : "Em acompanhamento"}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-muted-foreground">Nenhum dado acadêmico disponível ainda. Quando sua turma e matrícula forem vinculadas, os lançamentos aparecerão automaticamente aqui.</p>}
      </section>

      <section className="mt-5 sina-card sina-card-hover p-6">
        <h2 className="text-lg font-semibold">Próximos passos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="sina-interactive rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-primary/[0.02]"><p className="text-xs font-bold uppercase text-primary">1</p><p className="mt-2 text-sm font-semibold">Acesse seu dashboard</p><p className="mt-1 text-xs text-muted-foreground">Seu painel fica disponível assim que sua conta é criada.</p></div>
          <div className="sina-interactive rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-primary/[0.02]"><p className="text-xs font-bold uppercase text-primary">2</p><p className="mt-2 text-sm font-semibold">Aguarde o vínculo acadêmico</p><p className="mt-1 text-xs text-muted-foreground">Professor ou responsável autorizado poderá vincular sua turma e matrícula.</p></div>
          <div className="sina-interactive rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-primary/[0.02]"><p className="text-xs font-bold uppercase text-primary">3</p><p className="mt-2 text-sm font-semibold">Acompanhe seus dados</p><p className="mt-1 text-xs text-muted-foreground">Notas, frequência, matérias, avisos e tarefas aparecerão automaticamente.</p></div>
        </div>
      </section>
    </AcademicShell>
  );
}
