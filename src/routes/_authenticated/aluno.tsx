import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Megaphone, UserRound, FileText } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { errorText, getRole, loadDashboardAnnouncements, loadDashboardTasks, loadGrades, loadMyStudent, loadStudentAttendance, loadStudentAcademicMaterials } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({ meta: [{ title: "Dashboard do aluno — SINA" }, { name: "description", content: "Visão geral da vida acadêmica do aluno." }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const tasks = useQuery({ queryKey: ["dashboard-tasks"], queryFn: loadDashboardTasks, enabled: !!student.data });
  const grades = useQuery({ queryKey: ["dashboard-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id });
  const announcements = useQuery({ queryKey: ["dashboard-announcements"], queryFn: loadDashboardAnnouncements, enabled: !!student.data });
  const attendance = useQuery({ queryKey: ["dashboard-attendance"], queryFn: loadStudentAttendance, enabled: !!student.data });
  const materials = useQuery({ queryKey: ["dashboard-materials"], queryFn: loadStudentAcademicMaterials, enabled: !!student.data });

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
  const absences = attendance.data?.filter((item) => item.status === "absent").length ?? 0;
  const subjects = Array.from(new Set((grades.data ?? []).map(g=>g.subject)));

  return (
    <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico">
      <section className="mt-6 overflow-hidden rounded-3xl bg-brand p-5 text-brand-foreground shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-panel sm:size-14">
              {student.data.avatar_url ? <img src={student.data.avatar_url} alt="" className="size-full object-cover"/> : <UserRound className="size-6 text-brand-muted"/>}
            </div>
            <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">Visão geral</p><h2 className="mt-1 truncate font-display text-2xl font-bold md:text-3xl">Olá, {student.data.full_name.split(" ")[0]}! 👋</h2><p className="mt-1 text-sm text-brand-muted">Acompanhe rapidamente o que precisa da sua atenção.</p></div>
          </div>
          <Link to="/perfil" className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-panel">Meu perfil</Link>
        </div>
      </section>

      {(!student.data.classroom_id || !student.data.classroom) && (
        <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-semibold">Seu cadastro está pronto</p>
          <p className="mt-1 text-sm text-muted-foreground">Sua conta ainda precisa ser vinculada a uma turma pela escola. Depois disso, suas disciplinas, notas e frequência aparecerão aqui.</p>
        </section>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {to:"/aluno/tarefas",icon:ClipboardList,label:"Pendências",value:pending.length,desc:"tarefas para resolver"},
          {to:"/aluno/notas",icon:BarChart3,label:"Notas lançadas",value:grades.isPending ? "—" : grades.data?.length ?? 0,desc:"ver origem e avaliações"},
          {to:"/aluno/frequencia",icon:CheckCircle2,label:"Faltas",value:attendance.isPending ? "—" : absences,desc:"abrir histórico completo"},
          {to:"/aluno/disciplinas",icon:BookOpen,label:"Disciplinas",value:subjects.length,desc:"ver professores e turmas"},
        ].map(({to,icon:Icon,label,value,desc})=><Link key={label} to={to} className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></Link>)}
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Estudo</p><h2 className="mt-1 text-lg font-semibold">Materiais recentes</h2></div><FileText className="size-5 text-primary"/></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(materials.data ?? []).slice(0,4).map(item => <a key={item.id} href={item.file_url ?? "#"} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-4 transition hover:bg-muted/50">
            <p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.classroom_name}{item.subject_name ? " · "+item.subject_name : ""}</p><p className="mt-2 truncate text-xs text-muted-foreground">📎 {item.file_name}</p>
          </a>)}
          {!materials.isPending && !(materials.data ?? []).length && <p className="text-sm text-muted-foreground">Nenhum material publicado para sua turma.</p>}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="sina-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Agora</p><h2 className="mt-1 text-lg font-semibold">O que precisa da sua atenção</h2></div><Link to="/aluno/tarefas" className="text-sm font-semibold text-primary">Ver tudo</Link></div>
          <div className="mt-4 space-y-2">
            {pending.slice(0,5).map(task => <Link key={task.id} to="/aluno/tarefas" className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 hover:bg-muted/50"><div><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.due_at ? new Date(task.due_at).toLocaleDateString("pt-BR") : "Sem prazo"}{task.attachment_name ? " · 📎 material anexado" : ""}</p></div><ArrowRight className="size-4 text-muted-foreground"/></Link>)}
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

    </AcademicShell>
  );
}
