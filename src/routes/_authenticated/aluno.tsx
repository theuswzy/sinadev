import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Megaphone, UserRound, FileText, ChevronRight } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { errorText, getRole, loadDashboardAnnouncements, loadDashboardTasks, loadGrades, loadMyStudent, loadStudentAttendance, loadStudentAcademicMaterials, loadStudentCalendar, loadNotifications } from "@/lib/sina-data";

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
  const calendarRange = { from: new Date().toISOString(), to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() };
  const calendar = useQuery({ queryKey: ["dashboard-calendar", calendarRange.from.slice(0,10), calendarRange.to.slice(0,10)], queryFn: () => loadStudentCalendar(calendarRange.from, calendarRange.to), enabled: !!student.data, ...liveOptions });
  const notifications = useQuery({ queryKey: ["dashboard-notifications"], queryFn: () => loadNotifications(true), enabled: !!student.data, ...liveOptions });

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
  const scoredGrades = (grades.data ?? []).filter(g => Number.isFinite(Number(g.score)));
  const overallAverage = scoredGrades.length ? scoredGrades.reduce((sum, g) => sum + Number(g.score), 0) / scoredGrades.length : null;
  const presentCount = attendance.data?.filter(item => item.status === "present").length ?? 0;
  const absentCount = attendance.data?.filter(item => item.status === "absent").length ?? 0;
  const attendanceTotal = presentCount + absentCount;
  const attendancePercent = attendanceTotal ? (presentCount / attendanceTotal) * 100 : null;
  const subjects = Array.from(new Set((grades.data ?? []).map(g => g.subject))).filter(Boolean);
  const upcomingTasks = pending.filter(t => t.due_at && new Date(t.due_at).getTime() >= Date.now()).sort((a,b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()).slice(0,5);
  const overdueTasks = pending.filter(t => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const upcomingEvents = (calendar.data ?? []).filter(item => new Date(item.start_at).getTime() >= Date.now()).slice(0,5);
  const unreadCount = notifications.data?.length ?? 0;
  const academicStatus = !student.data.classroom_id ? "Aguardando vínculo" : pending.length ? "Acompanhar pendências" : "Em dia";

  return (
    <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico">
      <section className="mt-6 overflow-hidden rounded-3xl bg-brand p-6 text-brand-foreground shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-panel ring-1 ring-brand-border">
              {student.data.avatar_url ? <img src={student.data.avatar_url} alt="" className="size-full object-cover"/> : <UserRound className="size-7 text-brand-muted"/>}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">Área do aluno</p>
              <h2 className="mt-1 truncate font-display text-2xl font-bold md:text-3xl">Olá, {student.data.full_name.split(" ")[0]}! 👋</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                <span>{student.data.classroom || "Turma ainda não definida"}</span>
                {student.data.enrollment && <><span>•</span><span>Matrícula {student.data.enrollment}</span></>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-brand-border bg-brand-panel/70 px-3 py-2 text-xs font-semibold">{academicStatus}</span><Link to="/perfil" className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-panel">Meu perfil</Link></div>
        </div>
      </section>

      {!student.data.classroom_id && <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Seu cadastro está pronto, mas o vínculo acadêmico ainda não terminou.</p><p className="mt-1 text-sm text-muted-foreground">A escola precisa vincular você a uma turma. Depois disso, suas disciplinas, notas e frequência passam a aparecer automaticamente.</p></div><Link to="/perfil" className="shrink-0 text-sm font-semibold text-primary hover:underline">Ver meu perfil →</Link></div></section>}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {to:"/aluno/notas",icon:BarChart3,label:"Média geral",value:grades.isPending ? "—" : overallAverage == null ? "—" : overallAverage.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}),desc:"Notas registradas"},
          {to:"/aluno/frequencia",icon:CheckCircle2,label:"Frequência",value:attendance.isPending ? "—" : attendancePercent == null ? "—" : attendancePercent.toLocaleString("pt-BR",{maximumFractionDigits:0})+"%",desc:attendanceTotal ? (presentCount+" presença(s) em "+attendanceTotal+".") : "Sem registros ainda"},
          {to:"/aluno/tarefas",icon:ClipboardList,label:"Pendências",value:tasks.isPending ? "—" : pending.length,desc:pending.length?"Atividade(s) aguardando você":"Tudo em dia"},
          {to:"/aluno/disciplinas",icon:BookOpen,label:"Disciplinas",value:grades.isPending ? "—" : subjects.length,desc:"Com lançamentos acadêmicos"},
        ].map(({to,icon:Icon,label,value,desc})=><Link key={label} to={to} className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></Link>)}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="sina-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Minha rotina</p><h2 className="mt-1 text-lg font-semibold">O que merece sua atenção</h2></div><Link to="/aluno/tarefas" className="text-sm font-semibold text-primary">Ver tarefas</Link></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">Atividades próximas</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{upcomingTasks.length}</span></div><div className="mt-3 space-y-2">{upcomingTasks.map(task=><Link key={task.id} to="/aluno/tarefas" className="block rounded-xl border border-border p-3 transition hover:bg-muted/50"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {new Date(task.due_at!).toLocaleDateString("pt-BR")}</p></Link>)}{!tasks.isPending&&!upcomingTasks.length&&<p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Nenhuma atividade com prazo próximo.</p>}</div></div>
            <div className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">Agenda</p><Link to="/aluno/agenda" className="text-xs font-semibold text-primary">Abrir agenda</Link></div><div className="mt-3 space-y-2">{upcomingEvents.slice(0,3).map(item=><Link key={item.id} to="/aluno/agenda" className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted/50"><span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"><span className="text-[9px] font-bold uppercase">{new Date(item.start_at).toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}</span><span className="text-sm font-bold">{new Date(item.start_at).getDate()}</span></span><span className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{new Date(item.start_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</p></span></Link>)}{calendar.isPending&&<p className="text-sm text-muted-foreground">Carregando agenda…</p>}{!calendar.isPending&&!upcomingEvents.length&&<p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Nenhum compromisso próximo.</p>}</div></div>
          </div>
          {(overdueTasks.length>0 || unreadCount>0) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{overdueTasks.length>0&&<Link to="/aluno/tarefas" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><b>{overdueTasks.length} atividade(s) vencida(s)</b><p className="mt-1 text-xs text-muted-foreground">Revise os prazos e confira as entregas.</p></Link>}{unreadCount>0&&<Link to="/aluno/avisos" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><b>{unreadCount} notificação(ões) não lida(s)</b><p className="mt-1 text-xs text-muted-foreground">Abra os avisos para verificar o que mudou.</p></Link>}</div>}
        </section>

        <section className="sina-card p-5 sm:p-6"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Notificações</p><h2 className="mt-1 text-lg font-semibold">Atualizações recentes</h2></div><Bell className="size-5 text-primary"/></div><div className="mt-4 space-y-2">{(notifications.data ?? []).slice(0,4).map(item=><Link key={item.id} to={item.link || "/aluno"} className="block rounded-xl border border-border p-3 transition hover:bg-muted/50"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p></Link>)}{notifications.isPending&&<p className="text-sm text-muted-foreground">Carregando notificações…</p>}{!notifications.isPending&&!unreadCount&&<div className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Tudo certo por aqui. Nenhuma notificação não lida.</div>}{announcements.isPending&&<p className="mt-2 text-xs text-muted-foreground">Atualizando avisos…</p>}</div><Link to="/aluno/avisos" className="mt-4 inline-flex items-center text-sm font-semibold text-primary">Ver todos os avisos <ArrowRight className="ml-1 size-4"/></Link></section>
      </div>

      <section className="mt-5 sina-card p-5 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p><h2 className="mt-1 text-lg font-semibold">Como estão suas disciplinas?</h2></div><Link to="/aluno/notas" className="text-sm font-semibold text-primary">Ver notas completas</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2">{subjects.map(subject=>{const items=scoredGrades.filter(g=>g.subject===subject);const average=items.length?items.reduce((sum,g)=>sum+Number(g.score),0)/items.length:null;const percent=average==null?0:Math.max(0,Math.min(100,average*10));return <div key={subject} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="truncate font-semibold">{subject}</p><b>{average==null?"—":average.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{width:String(percent)+"%"}}/></div><p className="mt-2 text-[11px] text-muted-foreground">{items.length} lançamento(s) · média calculada sobre notas disponíveis</p></div>;})}{grades.isPending&&<p className="text-sm text-muted-foreground">Carregando desempenho…</p>}{!grades.isPending&&!subjects.length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Ainda não há lançamentos de notas suficientes para montar seu desempenho.</p>}</div></section>

      <section className="mt-5 sina-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Estudo</p><h2 className="mt-1 text-lg font-semibold">Materiais recentes</h2></div><FileText className="size-5 text-primary"/></div>{materials.error&&<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os materiais. <Button size="sm" variant="outline" className="ml-2" onClick={() => void materials.refetch()}>Tentar novamente</Button></div>}<div className="mt-4 grid gap-3 md:grid-cols-2">{(materials.data ?? []).slice(0,4).map(item => item.file_url ? <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4"/></span><div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-primary">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.classroom_name}{item.subject_name ? " · "+item.subject_name : ""}</p><p className="mt-2 truncate text-xs text-muted-foreground">📎 {item.file_name}</p></div></div></a> : <div key={item.id} className="rounded-2xl border border-border bg-muted/30 p-4"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">O arquivo está publicado, mas o link seguro precisa ser renovado.</p></div>)}{materials.isPending&&<p className="text-sm text-muted-foreground">Carregando materiais…</p>}{!materials.isPending&&!materials.error&&!(materials.data ?? []).length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum material publicado para sua turma.</p>}</div></section>
    </AcademicShell>
  );
}
