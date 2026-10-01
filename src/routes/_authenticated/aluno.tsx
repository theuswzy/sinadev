import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Megaphone, UserRound } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { errorText, formatScore, getRole, loadAnnouncements, loadGrades, loadMyStudent, loadTasks } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({ meta: [{ title: "Dashboard do aluno — SINA" }, { name: "description", content: "Visão geral da vida acadêmica do aluno." }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const tasks = useQuery({ queryKey: ["dashboard-tasks"], queryFn: loadTasks, enabled: !!student.data });
  const grades = useQuery({ queryKey: ["dashboard-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id });
  const announcements = useQuery({ queryKey: ["dashboard-announcements"], queryFn: loadAnnouncements, enabled: !!student.data });

  if (role.isPending || student.isPending) {
    return <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico"><div className="sina-card mt-8 p-6">Carregando seu dashboard...</div></AcademicShell>;
  }

  if (role.error || student.error) {
    return <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico"><div className="sina-card mt-8 p-6 text-sm text-destructive">{errorText(role.error ?? student.error)}</div></AcademicShell>;
  }

  if (role.data !== "student") {
    const destination = role.data === "teacher" ? "/professor" : "/admin";
    return <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico"><div className="sina-card mt-8 p-6">Esta conta possui outra área de acesso. <Link to={destination} className="text-primary underline">Abrir minha área</Link>.</div></AcademicShell>;
  }

  if (!student.data) {
    return <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico"><div className="sina-card mt-8 p-6"><p className="font-semibold">Perfil acadêmico ainda não encontrado.</p><Button className="mt-4" onClick={() => void student.refetch()}>Tentar novamente</Button></div></AcademicShell>;
  }

  const pending = (tasks.data ?? []).filter(t => !t.completed);
  const average = grades.data?.length ? grades.data.reduce((s,g)=>s+g.score,0)/(grades.data.length) : null;
  const absences = grades.data?.reduce((s,g)=>s+g.absences,0) ?? 0;
  const subjects = Array.from(new Set((grades.data ?? []).map(g=>g.subject)));

  return (
    <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico">
      <section className="mt-7 overflow-hidden rounded-3xl bg-brand p-6 text-brand-foreground md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-panel">
              {student.data.avatar_url ? <img src={student.data.avatar_url} alt="" className="size-full object-cover"/> : <UserRound className="size-6 text-brand-muted"/>}
            </div>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Dashboard do aluno</p><h2 className="mt-1 font-display text-2xl font-bold md:text-3xl">Olá, {student.data.full_name.split(" ")[0]}! 👋</h2><p className="mt-1 text-sm text-brand-muted">Aqui você encontra apenas o que precisa acompanhar agora.</p></div>
          </div>
          <Link to="/perfil" className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold hover:bg-brand-panel">Meu perfil</Link>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/aluno/tarefas" className="sina-card sina-card-hover p-5"><ClipboardList className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Pendências</p><p className="mt-1 text-3xl font-semibold">{pending.length}</p><p className="mt-1 text-xs text-muted-foreground">tarefas para resolver</p></Link>
        <Link to="/aluno/notas" className="sina-card sina-card-hover p-5"><BarChart3 className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Média geral</p><p className="mt-1 text-3xl font-semibold">{average == null ? "—" : formatScore(average)}</p><p className="mt-1 text-xs text-muted-foreground">com base nos lançamentos</p></Link>
        <Link to="/aluno/frequencia" className="sina-card sina-card-hover p-5"><CheckCircle2 className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Faltas</p><p className="mt-1 text-3xl font-semibold">{absences}</p><p className="mt-1 text-xs text-muted-foreground">registradas nas notas</p></Link>
        <Link to="/aluno/disciplinas" className="sina-card sina-card-hover p-5"><BookOpen className="size-5 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Disciplinas</p><p className="mt-1 text-3xl font-semibold">{subjects.length}</p><p className="mt-1 text-xs text-muted-foreground">com dados acadêmicos</p></Link>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="sina-card p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Agora</p><h2 className="mt-1 text-lg font-semibold">O que precisa da sua atenção</h2></div><Link to="/aluno/tarefas" className="text-sm font-semibold text-primary">Ver tudo</Link></div>
          <div className="mt-4 space-y-2">
            {pending.slice(0,5).map(task => <Link key={task.id} to="/aluno/tarefas" className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 hover:bg-muted/50"><div><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.due_at ? new Date(task.due_at).toLocaleDateString("pt-BR") : "Sem prazo"}</p></div><ArrowRight className="size-4 text-muted-foreground"/></Link>)}
            {!pending.length && <div className="rounded-xl bg-secondary/50 p-5 text-sm text-muted-foreground">Você não tem tarefas pendentes. 🎉</div>}
          </div>
        </div>

        <div className="sina-card p-6">
          <div className="flex items-center gap-3"><Megaphone className="size-5 text-primary"/><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Avisos</p><h2 className="mt-1 text-lg font-semibold">Últimos comunicados</h2></div></div>
          <div className="mt-4 space-y-3">
            {(announcements.data ?? []).slice(0,4).map(item => <Link key={item.id} to="/aluno/avisos" className="block rounded-xl border border-border p-3 hover:bg-muted/50"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p></Link>)}
            {!announcements.data?.length && <p className="text-sm text-muted-foreground">Nenhum aviso novo.</p>}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Acesso rápido</p><h2 className="mt-1 text-lg font-semibold">Áreas do SINA</h2></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["/aluno/tarefas","Tarefas",ClipboardList],
            ["/aluno/disciplinas","Disciplinas",BookOpen],
            ["/aluno/notas","Notas",BarChart3],
            ["/aluno/frequencia","Frequência",CheckCircle2],
            ["/aluno/agenda","Agenda",CalendarDays],
          ].map(([href,label,Icon]) => <Link key={String(href)} to={href as never} className="sina-card sina-card-hover flex items-center gap-3 p-4"><Icon className="size-5 text-primary"/><span className="text-sm font-semibold">{String(label)}</span><ArrowRight className="ml-auto size-4 text-muted-foreground"/></Link>)}
        </div>
      </section>
    </AcademicShell>
  );
}
