import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Megaphone, UserRound, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { StudentModulePage, type StudentModule } from "@/components/student-module-page";
import { StudentNotifications } from "@/routes/_authenticated/aluno/notificacoes";
import { Button } from "@/components/ui/button";
import { errorText, getRole, loadGrades, loadMyStudent, loadStudentAcademicMaterialsDetailed, loadStudentCalendar, loadStudentAssessmentsDetailed, loadStudentSubjects, loadStudentTasksDetailed, loadStudentAnnouncementsDetailed, loadStudentAttendanceDetailed, loadNotifications } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({ meta: [{ title: "Dashboard do aluno — SINA" }, { name: "description", content: "Visão geral da vida acadêmica do aluno." }] }),
  component: StudentArea,
});

const studentModuleByPath: Record<string, StudentModule> = {
  "/aluno/tarefas": "tarefas",
  "/aluno/disciplinas": "disciplinas",
  "/aluno/notas": "notas",
  "/aluno/frequencia": "frequencia",
  "/aluno/agenda": "agenda",
  "/aluno/avisos": "avisos",
  "/aluno/materiais": "materiais",
};

function StudentArea() {
  const location = useLocation();
  const module = studentModuleByPath[location.pathname];

  if (module) return <StudentModulePage module={module} />;
  if (location.pathname === "/aluno/notificacoes") return <StudentNotifications />;
  return <StudentDashboard />;
}

function StudentDashboard() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const liveOptions = { refetchOnWindowFocus: true, refetchInterval: 30000 };
  const tasks = useQuery({ queryKey: ["dashboard-tasks"], queryFn: loadStudentTasksDetailed, enabled: !!student.data, ...liveOptions });
  const grades = useQuery({ queryKey: ["dashboard-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id, ...liveOptions });
  const assessments = useQuery({ queryKey: ["dashboard-assessments"], queryFn: loadStudentAssessmentsDetailed, enabled: !!student.data, ...liveOptions });
  const studentSubjects = useQuery({ queryKey: ["dashboard-student-subjects"], queryFn: loadStudentSubjects, enabled: !!student.data, ...liveOptions });
  const announcements = useQuery({ queryKey: ["dashboard-announcements"], queryFn: loadStudentAnnouncementsDetailed, enabled: !!student.data, ...liveOptions });
  const attendance = useQuery({ queryKey: ["dashboard-attendance"], queryFn: loadStudentAttendanceDetailed, enabled: !!student.data, ...liveOptions });
  const materials = useQuery({ queryKey: ["dashboard-materials"], queryFn: loadStudentAcademicMaterialsDetailed, enabled: !!student.data, ...liveOptions });
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
  const hasSchoolLink = !!student.data?.institution_id;
  const hasClassroomLink = !!student.data?.classroom_id;

  if (!student.data || !hasSchoolLink) {
    return (
      <AcademicShell title="Dashboard" subtitle="Meu espaço acadêmico">
        <section className="mt-6 sina-card overflow-hidden">
          <div className="bg-brand p-6 text-brand-foreground sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">Área do aluno</p>
            <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">Olá! 👋</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
              Sua conta está ativa. Vamos concluir seu cadastro acadêmico.
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Conta</p>
              <p className="mt-1 font-semibold">Ativa</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Instituição</p>
              <p className="mt-1 font-semibold text-muted-foreground">Pendente</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Turma</p>
              <p className="mt-1 font-semibold text-muted-foreground">Pendente</p>
            </div>
          </div>
          <div className="border-t border-border px-6 py-5 sm:px-8">
            <p className="text-sm text-muted-foreground">
              Assim que sua instituição for definida, suas informações acadêmicas aparecerão aqui.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/perfil" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Ver meu perfil
              </Link>
              <Button variant="outline" onClick={() => void student.refetch()}>
                Atualizar
              </Button>
            </div>
          </div>
        </section>
      </AcademicShell>
    );
  }

  const pending = (tasks.data ?? []).filter(t => !t.completed);
  const pendingGroups = Array.from(
    pending.reduce((map, task) => {
      const subject = task.subject_name || task.subject || "Sem disciplina";
      const key = `${task.subject_id ?? subject}::${task.teacher_id}`;
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, {
        subject,
        teacher: task.teacher_name || "Professor não identificado",
        count: 1,
      });
      return map;
    }, new Map<string, { subject: string; teacher: string; count: number }>())
      .values(),
  ).sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR") || a.teacher.localeCompare(b.teacher, "pt-BR"));
  const scoredGrades = (grades.data ?? []).filter(g => Number.isFinite(Number(g.score)));
  const subjectTeachers = (subject: string) => Array.from(new Set((studentSubjects.data ?? []).filter(item => item.name === subject).map(item => item.teacher_name).filter(Boolean)));
  const teacherNamesById = new Map((studentSubjects.data ?? []).map(item => [item.teacher_id, item.teacher_name] as const));
  const gradeTeacherNames = (subject: string) => {
    const exact = Array.from(new Set(
      scoredGrades.filter(g => g.subject === subject && g.teacher_id).map(g => g.teacher_id ? teacherNamesById.get(g.teacher_id) : null).filter(Boolean),
    )) as string[];
    return exact.length ? exact : subjectTeachers(subject);
  };
  const uniqueSubjectCount = new Set((studentSubjects.data ?? []).map(item => item.id)).size;
  const uniqueTeacherCount = new Set((studentSubjects.data ?? []).map(item => item.teacher_id)).size;
  const gradedAssessments = (assessments.data ?? []).filter(item => item.score != null && Number(item.max_score) > 0 && Number(item.weight) > 0);
  const totalAssessmentWeight = gradedAssessments.reduce((sum, item) => sum + Number(item.weight), 0);
  const weightedAverage = totalAssessmentWeight > 0 ? gradedAssessments.reduce((sum, item) => sum + ((Number(item.score) / Number(item.max_score)) * 10 * Number(item.weight)), 0) / totalAssessmentWeight : null;
  const overallAverage = weightedAverage ?? (scoredGrades.length ? scoredGrades.reduce((sum, g) => sum + Number(g.score), 0) / scoredGrades.length : null);
  const presentCount = attendance.data?.filter(item => item.status === "present").length ?? 0;
  const absentCount = attendance.data?.filter(item => item.status === "absent").length ?? 0;
  const lateCount = attendance.data?.filter(item => item.status === "late").length ?? 0;
  const excusedCount = attendance.data?.filter(item => item.status === "excused").length ?? 0;
  const attendanceTotal = attendance.data?.length ?? 0;
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
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-brand-border bg-brand-panel/70 px-3 py-2 text-xs font-semibold">{academicStatus}</span>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-brand-border bg-transparent text-brand-foreground hover:bg-brand-panel"
              onClick={() => void Promise.all([
                student.refetch(),
                tasks.refetch(),
                grades.refetch(),
                assessments.refetch(),
                studentSubjects.refetch(),
                announcements.refetch(),
                attendance.refetch(),
                materials.refetch(),
                calendar.refetch(),
                notifications.refetch(),
              ])}
              disabled={[student,tasks,grades,assessments,studentSubjects,announcements,attendance,materials,calendar,notifications].some(query => query.isFetching)}
              title="Atualizar informações acadêmicas"
            >
              <RefreshCw className={"mr-2 size-4 " + ([student,tasks,grades,assessments,studentSubjects,announcements,attendance,materials,calendar,notifications].some(query => query.isFetching) ? "animate-spin" : "")} />
              Atualizar
            </Button>
            <Link to="/perfil" className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-panel">Meu perfil</Link>
          </div>
        </div>
      </section>

      {!student.data.classroom_id && <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Seu dashboard já está pronto.</p><p className="mt-1 text-sm text-muted-foreground">A escola ainda precisa concluir seu vínculo com uma turma. Enquanto isso, você já pode acessar seu perfil e acompanhar este painel; notas, frequência, disciplinas e atividades aparecerão conforme forem cadastradas.</p></div><Link to="/perfil" className="shrink-0 text-sm font-semibold text-primary hover:underline">Ver meu perfil →</Link></div></section>}

      {[tasks, grades, assessments, studentSubjects, announcements, attendance, materials, calendar, notifications].some(query => query.error) && <section className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">Algumas informações podem estar desatualizadas.</p><p className="mt-1 text-sm text-muted-foreground">O SINA conseguiu carregar parte do seu dashboard, mas houve uma falha em alguns serviços. Você pode tentar atualizar novamente sem perder o que já foi carregado.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([tasks.refetch(), grades.refetch(), assessments.refetch(), studentSubjects.refetch(), announcements.refetch(), attendance.refetch(), materials.refetch(), calendar.refetch(), notifications.refetch()])}>Tentar novamente</Button></div></section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {to:"/aluno/notas",icon:BarChart3,label:"Média geral",value:grades.isPending ? "—" : overallAverage == null ? "—" : overallAverage.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}),desc:weightedAverage != null ? "Média ponderada das avaliações" : "Notas registradas"},
          {to:"/aluno/frequencia",icon:CheckCircle2,label:"Frequência",value:attendance.isPending ? "—" : attendancePercent == null ? "—" : attendancePercent.toLocaleString("pt-BR",{maximumFractionDigits:0})+"%",desc:attendanceTotal ? (presentCount+" presença(s), "+absentCount+" falta(s).") : "Sem registros ainda"},
          {to:"/aluno/tarefas",icon:ClipboardList,label:"Pendências",value:tasks.isPending ? "—" : pending.length,desc:pending.length?"Atividade(s) aguardando você":"Tudo em dia"},
          {to:"/aluno/disciplinas",icon:BookOpen,label:"Disciplinas",value:studentSubjects.isPending ? "—" : uniqueSubjectCount,desc:studentSubjects.isPending ? "Carregando vínculos" : uniqueTeacherCount + (uniqueTeacherCount === 1 ? " professor vinculado" : " professores vinculados")},
        ].map(({to,icon:Icon,label,value,desc})=><Link key={label} to={to} className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></Link>)}
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Minha turma</p><h2 className="mt-1 text-lg font-semibold">Matérias e professores</h2><p className="mt-1 text-sm text-muted-foreground">Cada vínculo aparece separado para evitar misturar atividades, notas e avisos de professores diferentes.</p></div>
          <Link to="/aluno/disciplinas" className="text-sm font-semibold text-primary">Ver disciplinas</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(studentSubjects.data ?? []).map(item => {
            const pendingCount = pending.filter(task => (task.subject_id && task.subject_id === item.id) || (!task.subject_id && (task.subject_name || task.subject) === item.name)).length;
            return <a key={item.id + item.teacher_id} href={"/aluno/disciplinas#" + item.id + "::" + item.teacher_id} className="rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5">
              <div className="flex items-start justify-between gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4"/></span>{pendingCount > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">{pendingCount} pend.</span>}</div>
              <p className="mt-3 font-semibold">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">Prof. {item.teacher_name || "não informado"}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{item.classroom_name}</p>
              <p className="mt-3 text-xs font-semibold text-primary">Abrir disciplina →</p>
            </a>;
          })}
          {studentSubjects.isPending && <p className="text-sm text-muted-foreground">Carregando matérias e professores…</p>}
          {!studentSubjects.isPending && !(studentSubjects.data ?? []).length && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Nenhuma disciplina foi vinculada à sua turma ainda.</p>}
        </div>
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Frequência</p>
            <h2 className="mt-1 text-lg font-semibold">Como está sua presença</h2>
            <p className="mt-1 text-sm text-muted-foreground">O mesmo cálculo da área detalhada: presenças divididas por todos os registros disponíveis.</p>
          </div>
          <Link to="/aluno/frequencia" className="text-sm font-semibold text-primary">Ver histórico completo →</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Presenças</p><p className="mt-1 text-2xl font-semibold">{attendance.isPending ? "—" : presentCount}</p></div>
          <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Faltas</p><p className="mt-1 text-2xl font-semibold">{attendance.isPending ? "—" : absentCount}</p></div>
          <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Outros registros</p><p className="mt-1 text-2xl font-semibold">{attendance.isPending ? "—" : lateCount + excusedCount}</p><p className="mt-1 text-[11px] text-muted-foreground">atrasos + justificativas</p></div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="sina-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Minha rotina</p><h2 className="mt-1 text-lg font-semibold">O que merece sua atenção</h2></div><Link to="/aluno/tarefas" className="text-sm font-semibold text-primary">Ver tarefas</Link></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">Atividades próximas</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{upcomingTasks.length}</span></div><div className="mt-3 space-y-2">{upcomingTasks.map(task=><Link key={task.id} to="/aluno/tarefas" className="block rounded-xl border border-border p-3 transition hover:bg-muted/50"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject_name || task.subject} · Prof. {task.teacher_name || "não identificado"} · {new Date(task.due_at!).toLocaleDateString("pt-BR")}</p></Link>)}{!tasks.isPending&&!upcomingTasks.length&&<p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Nenhuma atividade com prazo próximo.</p>}</div></div>
            <div className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary"/><p className="font-semibold">Agenda</p></div><Link to="/aluno/agenda" className="text-xs font-semibold text-primary">Abrir agenda</Link></div><div className="mt-3 space-y-2">{upcomingEvents.slice(0,3).map(item=><Link key={item.id} to="/aluno/agenda" className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted/50"><span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"><span className="text-[9px] font-bold uppercase">{new Date(item.start_at).toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}</span><span className="text-sm font-bold">{new Date(item.start_at).getDate()}</span></span><span className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{new Date(item.start_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</p></span></Link>)}{calendar.isPending&&<p className="text-sm text-muted-foreground">Carregando agenda…</p>}{!calendar.isPending&&!upcomingEvents.length&&<p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Nenhum compromisso próximo.</p>}</div></div>
          </div>
          {(overdueTasks.length>0 || unreadCount>0) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{overdueTasks.length>0&&<Link to="/aluno/tarefas" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><b>{overdueTasks.length} atividade(s) vencida(s)</b><p className="mt-1 text-xs text-muted-foreground">Revise os prazos e confira as entregas.</p></Link>}{unreadCount>0&&<Link to="/aluno/notificacoes" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><b>{unreadCount} notificação(ões) não lida(s)</b><p className="mt-1 text-xs text-muted-foreground">Abra a central para marcar como lida ou abrir o conteúdo.</p></Link>}</div>}
        </section>

        <section className="sina-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Atualizações</p><h2 className="mt-1 text-lg font-semibold">O que mudou recentemente</h2></div><Link to="/aluno/notificacoes" className="rounded-lg p-1 text-primary hover:bg-primary/10" aria-label="Abrir notificações"><Bell className="size-5"/></Link></div>
          <div className="mt-4 space-y-2">
            {(notifications.data ?? []).slice(0,3).map(item=><Link key={item.id} to={item.link || "/aluno"} className="flex items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-muted/50"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="size-4"/></span><span className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p></span><ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground"/></Link>)}
            {notifications.isPending&&<p className="text-sm text-muted-foreground">Carregando notificações…</p>}
            {!notifications.isPending&&!unreadCount&&<div className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Nenhuma notificação não lida no momento.</div>}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Megaphone className="size-4 text-primary"/><p className="text-sm font-semibold">Últimos avisos</p></div><Link to="/aluno/avisos" className="text-xs font-semibold text-primary">Ver todos</Link></div>
            <div className="mt-3 space-y-2">
              {(announcements.data ?? []).slice(0,2).map(item=><Link key={item.id} to="/aluno/avisos" className="block rounded-xl border border-border p-3 transition hover:bg-muted/50"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">Prof. {item.teacher_name} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></Link>)}
              {announcements.isPending&&<p className="text-xs text-muted-foreground">Atualizando avisos…</p>}
              {!announcements.isPending&&!(announcements.data ?? []).length&&<p className="text-xs text-muted-foreground">Nenhum aviso publicado para você.</p>}
            </div>
          </div>
          <Link to="/aluno/avisos" className="mt-4 inline-flex items-center text-sm font-semibold text-primary">Abrir central de avisos <ArrowRight className="ml-1 size-4"/></Link>
        </section>
      </div>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Pendências por matéria</p><h2 className="mt-1 text-lg font-semibold">Saiba exatamente com quem você precisa acompanhar</h2></div>
          <Link to="/aluno/tarefas" className="text-sm font-semibold text-primary">Ver todas</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendingGroups.slice(0, 6).map(group => (
            <Link key={group.subject + group.teacher} to="/aluno/tarefas" className="rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold">{group.subject}</p><p className="mt-1 text-xs text-muted-foreground">Prof. {group.teacher}</p></div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{group.count}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Atividade{group.count === 1 ? "" : "s"} aguardando sua atenção.</p>
            </Link>
          ))}
          {!pending.length && <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Nenhuma pendência acadêmica no momento. Você está em dia.</div>}
        </div>
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Acesso rápido</p><h2 className="mt-1 text-lg font-semibold">O que você precisa agora?</h2></div>
          <ArrowRight className="size-5 text-primary"/>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {to:"/aluno/tarefas",label:"Tarefas",desc:"Veja prazos e entregas.",Icon:ClipboardList},
            {to:"/aluno/notas",label:"Notas",desc:"Confira seu desempenho.",Icon:BarChart3},
            {to:"/aluno/frequencia",label:"Frequência",desc:"Acompanhe sua presença.",Icon:CheckCircle2},
            {to:"/aluno/agenda",label:"Agenda",desc:"Veja os próximos eventos.",Icon:CalendarDays},
          ].map(({to,label,desc,Icon})=>(
            <Link key={to} to={to} className="group rounded-2xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></span>
              <p className="mt-3 font-semibold group-hover:text-primary">{label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 sina-card p-5 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p><h2 className="mt-1 text-lg font-semibold">Como estão suas disciplinas?</h2></div><Link to="/aluno/notas" className="text-sm font-semibold text-primary">Ver notas completas</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2">{subjects.map(subject=>{const items=scoredGrades.filter(g=>g.subject===subject);const average=items.length?items.reduce((sum,g)=>sum+Number(g.score),0)/items.length:null;const percent=average==null?0:Math.max(0,Math.min(100,average*10));const teachers=gradeTeacherNames(subject);return <div key={subject} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{teachers.length ? "Prof. "+teachers.join(", ") : "Professor não informado"}</p></div><b>{average==null?"—":average.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{width:String(percent)+"%"}}/></div><p className="mt-2 text-[11px] text-muted-foreground">{items.length} lançamento(s) · média calculada sobre notas disponíveis</p></div>;})}{grades.isPending&&<p className="text-sm text-muted-foreground">Carregando desempenho…</p>}{!grades.isPending&&!subjects.length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Ainda não há lançamentos de notas suficientes para montar seu desempenho.</p>}</div></section>

      <section className="mt-5 sina-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Estudo</p><h2 className="mt-1 text-lg font-semibold">Materiais recentes</h2></div><FileText className="size-5 text-primary"/></div>{materials.error&&<div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Não foi possível carregar os materiais. <Button size="sm" variant="outline" className="ml-2" onClick={() => void materials.refetch()}>Tentar novamente</Button></div>}<div className="mt-4 grid gap-3 md:grid-cols-2">{(materials.data ?? []).slice(0,4).map(item => item.file_url ? <a key={item.id} href={item.file_url} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4"/></span><div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-primary">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.classroom_name}{item.subject_name ? " · "+item.subject_name : ""}{item.teacher_name ? " · Prof. "+item.teacher_name : ""}</p><p className="mt-2 truncate text-xs text-muted-foreground">📎 {item.file_name}</p></div></div></a> : <div key={item.id} className="rounded-2xl border border-border bg-muted/30 p-4"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">O arquivo está publicado, mas o link seguro precisa ser renovado.</p></div>)}{materials.isPending&&<p className="text-sm text-muted-foreground">Carregando materiais…</p>}{!materials.isPending&&!materials.error&&!(materials.data ?? []).length&&<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum material publicado para sua turma.</p>}</div></section>
    </AcademicShell>
  );
}