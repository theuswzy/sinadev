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
  const liveOptions = { refetchOnWindowFocus: true, refetchInterval: 30000 };
  const tasks = useQuery({ queryKey: ["dashboard-tasks"], queryFn: loadDashboardTasks, enabled: !!student.data, ...liveOptions });
  const grades = useQuery({ queryKey: ["dashboard-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id, ...liveOptions });
  const announcements = useQuery({ queryKey: ["dashboard-announcements"], queryFn: loadDashboardAnnouncements, enabled: !!student.data, ...liveOptions });
  const attendance = useQuery({ queryKey: ["dashboard-attendance"], queryFn: loadStudentAttendance, enabled: !!student.data, ...liveOptions });
  const materials = useQuery({ queryKey: ["dashboard-materials"], queryFn: loadStudentAcademicMaterials, enabled: !!student.data, ...liveOptions });

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
  const scoredGrades = (grades.data ?? []).filter(g => Number.isFinite(Number(g.score)));
  const overallAverage = scoredGrades.length
    ? scoredGrades.reduce((sum, g) => sum + Number(g.score), 0) / scoredGrades.length
    : null;
  const presentCount = attendance.data?.filter(item => item.status === "present").length ?? 0;
  const absentCount = attendance.data?.filter(item => item.status === "absent").length ?? 0;
  const attendanceTotal = presentCount + absentCount;
  const attendancePercent = attendanceTotal ? (presentCount / attendanceTotal) * 100 : null;

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

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Precisa da sua atenção</p><h2 className="mt-1 text-lg font-semibold">Próximos passos</h2></div><Bell className="size-5 text-primary"/></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link to="/aluno/tarefas" className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"><p className="text-xs font-bold uppercase text-muted-foreground">Pendências</p><p className="mt-1 text-2xl font-semibold">{pending.length}</p><p className="mt-1 text-xs text-muted-foreground">{pending.length?"Atividade(s) aguardando você.":"Você está em dia."}</p></Link>
          <Link to="/aluno/tarefas" className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"><p className="text-xs font-bold uppercase text-muted-foreground">Próximas atividades</p><p className="mt-1 text-2xl font-semibold">{(tasks.data??[]).filter(t=>!t.completed&&t.due_at&&new Date(t.due_at).getTime()>=Date.now()).length}</p><p className="mt-1 text-xs text-muted-foreground">Com prazo futuro.</p></Link>
          <Link to="/aluno/avisos" className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"><p className="text-xs font-bold uppercase text-muted-foreground">Avisos</p><p className="mt-1 text-2xl font-semibold">{announcements.data?.length??0}</p><p className="mt-1 text-xs text-muted-foreground">Comunicados disponíveis.</p></Link>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {to:"/aluno/tarefas",icon:ClipboardList,label:"Pendências",value:pending.length,desc:"tarefas para resolver"},
          {to:"/aluno/notas",icon:BarChart3,label:"Notas lançadas",value:grades.isPending ? "—" : grades.data?.length ?? 0,desc:"ver origem e avaliações"},
          {to:"/aluno/frequencia",icon:CheckCircle2,label:"Faltas",value:attendance.isPending ? "—" : absences,desc:"abrir histórico completo"},
          {to:"/aluno/disciplinas",icon:BookOpen,label:"Disciplinas",value:subjects.length,desc:"ver professores e turmas"},
        ].map(({to,icon:Icon,label,value,desc})=><Link key={label} to={to} className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></Link>)}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link to="/aluno/notas" className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Média geral</p>
          <p className="mt-1 text-3xl font-semibold">{grades.isPending ? "—" : overallAverage == null ? "—" : overallAverage.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2})}</p>
          <p className="mt-1 text-xs text-muted-foreground">Média simples das notas lançadas.</p>
        </Link>
        <Link to="/aluno/frequencia" className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Frequência registrada</p>
          <p className="mt-1 text-3xl font-semibold">{attendance.isPending ? "—" : attendancePercent == null ? "—" : attendancePercent.toLocaleString("pt-BR",{maximumFractionDigits:0})+"%"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{attendanceTotal ? `${presentCount} presença(s) em ${attendanceTotal} registro(s).` : "Ainda não há registros de presença."}</p>
        </Link>
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p><h2 className="mt-1 text-lg font-semibold">Notas por disciplina</h2></div><Link to="/aluno/notas" className="text-sm font-semibold text-primary">Ver detalhes</Link></div>
        <div className="mt-4 space-y-3">
          {Array.from(new Set((grades.data ?? []).map(g => g.subject))).map(subject => {
            const items = scoredGrades.filter(g => g.subject === subject);
            const average = items.length ? items.reduce((sum,g) => sum + Number(g.score),0) / items.length : null;
            const percent = average == null ? 0 : Math.max(0, Math.min(100, average * 10));
            return <div key={subject} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold">{subject}</p><b>{average == null ? "—" : average.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}</b></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width: `${percent}%`}} /></div>
              <p className="mt-1 text-[11px] text-muted-foreground">{items.length} lançamento(s)</p>
            </div>;
          })}
          {!grades.isPending && !subjects.length && <p className="text-sm text-muted-foreground">Ainda não há notas por disciplina.</p>}
          {grades.isPending && <p className="text-sm text-muted-foreground">Carregando desempenho…</p>}
        </div>
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Estudo</p><h2 className="mt-1 text-lg font-semibold">Materiais recentes</h2></div><FileText className="size-5 text-primary"/></div>
        {materials.error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os materiais. <Button size="sm" variant="outline" className="ml-2" onClick={() => void materials.refetch()}>Tentar novamente</Button></div>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(materials.data ?? []).slice(0,4).map(item => item.file_url ? <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-4 transition hover:bg-muted/50">
            <p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.classroom_name}{item.subject_name ? " · "+item.subject_name : ""}</p><p className="mt-2 truncate text-xs text-muted-foreground">📎 {item.file_name}</p>
          </a> : <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.classroom_name}{item.subject_name ? " · "+item.subject_name : ""}</p><p className="mt-2 text-xs text-muted-foreground">O arquivo está publicado, mas o link seguro precisa ser renovado.</p>
          </div>)}
          {materials.isPending && <p className="text-sm text-muted-foreground">Carregando materiais…</p>}
          {!materials.isPending && !materials.error && !(materials.data ?? []).length && <p className="text-sm text-muted-foreground">Nenhum material publicado para sua turma.</p>}
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
