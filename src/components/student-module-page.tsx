import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Megaphone, BookOpen, Clock3, CheckCircle2, AlertTriangle, UserRound, ClipboardCheck } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  errorText,
  formatScore,
  loadGrades,
  loadMyStudent,
  loadStudentAssessmentsDetailed,
  loadStudentAttendance,
  loadStudentCalendar,
  loadStudentTaskSubmissions,
  loadStudentTasksDetailed,
  loadStudentAnnouncementsDetailed,
  loadStudentSubjects,
  type Grade,
  submitTask,
} from "@/lib/sina-data";

export type StudentModule = "tarefas" | "disciplinas" | "notas" | "frequencia" | "agenda" | "avisos";

const meta: Record<StudentModule, { title: string; subtitle: string }> = {
  tarefas: { title: "Tarefas", subtitle: "Atividades e entregas" },
  disciplinas: { title: "Disciplinas", subtitle: "Suas disciplinas e desempenho" },
  notas: { title: "Notas", subtitle: "Notas, avaliações e resultados" },
  frequencia: { title: "Frequência", subtitle: "Seu histórico de presença" },
  agenda: { title: "Agenda", subtitle: "Compromissos e próximos eventos" },
  avisos: { title: "Avisos", subtitle: "Comunicados da instituição e dos professores" },
};

export function StudentModulePage({ module }: { module: StudentModule }) {
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent });
  const tasks = useQuery({ queryKey: ["student-module-tasks"], queryFn: loadStudentTasksDetailed, enabled: module === "tarefas" });
  const studentSubjects = useQuery({ queryKey: ["student-module-subjects"], queryFn: loadStudentSubjects, enabled: module === "disciplinas" || module === "tarefas" || module === "notas" });
  const grades = useQuery({ queryKey: ["student-module-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id && (module === "disciplinas" || module === "notas") });
  const assessments = useQuery({ queryKey: ["student-module-assessments"], queryFn: loadStudentAssessmentsDetailed, enabled: module === "notas" });
  const attendance = useQuery({ queryKey: ["student-module-attendance"], queryFn: loadStudentAttendance, enabled: module === "frequencia" });
  const announcements = useQuery({ queryKey: ["student-module-announcements"], queryFn: loadStudentAnnouncementsDetailed, enabled: module === "avisos" });
  const submissions = useQuery({ queryKey: ["student-module-submissions"], queryFn: loadStudentTaskSubmissions, enabled: module === "tarefas" });
  const calendar = useQuery({
    queryKey: ["student-module-calendar"],
    queryFn: () => {
      const from = new Date();
      const to = new Date();
      to.setMonth(to.getMonth() + 2);
      return loadStudentCalendar(from.toISOString(), to.toISOString());
    },
    enabled: module === "agenda",
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");

  const subjects = useMemo(() => {
    const rows = grades.data ?? [];
    return Array.from(new Set(rows.map((g) => g.subject))).map((subject) => {
      const items = rows.filter((g) => g.subject === subject);
      const average = items.length > 0
        ? items.reduce((sum, item) => sum + item.score, 0) / items.length
        : null;
      return {
        subject,
        average,
        absences: items.reduce((sum, item) => sum + item.absences, 0),
        periods: items.length,
        periodScores: items.map((item) => ({ period: item.period, score: item.score })),
      };
    });
  }, [grades.data]);

  async function sendTask(taskId: string) {
    setSending(taskId);
    try {
      await submitTask(taskId, drafts[taskId] ?? "");
      await submissions.refetch();
      toast.success("Entrega enviada para correção.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(null);
    }
  }

  const pendingTasks = (tasks.data ?? []).filter((task) => !task.completed);
  const taskGroups = useMemo(() => {
    const filtered = subjectFilter === "all"
      ? (tasks.data ?? [])
      : (tasks.data ?? []).filter((task) => task.subject_name === subjectFilter);
    const groups = new Map<string, {
      subject: string;
      teacherId: string;
      teacher: string;
      classroom: string;
      tasks: typeof filtered;
    }>();
    for (const task of filtered) {
      const subject = task.subject_name || task.subject || "Sem disciplina";
      const key = `${task.subject_id ?? subject}::${task.teacher_id}`;
      const current = groups.get(key);
      if (current) current.tasks.push(task);
      else groups.set(key, {
        subject,
        teacherId: task.teacher_id,
        teacher: task.teacher_name || "Professor não identificado",
        classroom: task.classroom_name || task.classroom,
        tasks: [task],
      });
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.subject.localeCompare(b.subject, "pt-BR") || a.teacher.localeCompare(b.teacher, "pt-BR")
    );
  }, [tasks.data, subjectFilter]);

  const assessmentGroups = useMemo(() => {
    const groups = new Map<string, {
      subject: string;
      teacher: string;
      classroom: string;
      items: Array<NonNullable<typeof assessments.data>[number]>;
    }>();
    for (const item of assessments.data ?? []) {
      const subject = item.subject_name || "Sem disciplina";
      const key = `${item.subject_id ?? subject}::${item.teacher_id}`;
      const current = groups.get(key);
      if (current) current.items.push(item);
      else groups.set(key, {
        subject,
        teacher: item.teacher_name || "Professor não identificado",
        classroom: item.classroom_name,
        items: [item],
      });
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.subject.localeCompare(b.subject, "pt-BR") || a.teacher.localeCompare(b.teacher, "pt-BR")
    );
  }, [assessments.data]);

  const teacherNamesBySubject = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of studentSubjects.data ?? []) {
      const list = map.get(item.name) ?? [];
      if (item.teacher_name && !list.includes(item.teacher_name)) list.push(item.teacher_name);
      map.set(item.name, list);
    }
    return map;
  }, [studentSubjects.data]);

  const teacherNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of studentSubjects.data ?? []) {
      if (item.teacher_name) map.set(item.teacher_id, item.teacher_name);
    }
    return map;
  }, [studentSubjects.data]);

  const gradeTeachers = (grade: Grade) => {
    if (grade.teacher_id) {
      const teacher = teacherNamesById.get(grade.teacher_id);
      if (teacher) return [teacher];
    }
    return teacherNamesBySubject.get(grade.subject) ?? [];
  };

  const now = Date.now();
  const overdueTasks = pendingTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < now);
  const attendanceSummary = useMemo(() => {
    const rows = attendance.data ?? [];
    const present = rows.filter((item) => item.status === "present").length;
    const absent = rows.filter((item) => item.status === "absent").length;
    const late = rows.filter((item) => item.status === "late").length;
    const excused = rows.filter((item) => item.status === "excused").length;
    const percentage = rows.length ? Math.round((present / rows.length) * 100) : null;
    return { total: rows.length, present, absent, late, excused, percentage };
  }, [attendance.data]);
  const title = meta[module];
  const activeQuery = module === "tarefas" ? tasks
    : module === "disciplinas" ? studentSubjects
    : module === "notas" ? grades
    : module === "frequencia" ? attendance
    : module === "agenda" ? calendar
    : announcements;

  if (student.isPending) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6">Carregando...</div></AcademicShell>;
  }

  if (student.error) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6 text-sm text-destructive"><p>{errorText(student.error)}</p><Button className="mt-4" variant="outline" onClick={() => void student.refetch()}>Tentar novamente</Button></div></AcademicShell>;
  }

  if (!student.data) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6"><p className="font-semibold">Seu vínculo acadêmico ainda não foi concluído.</p><p className="mt-1 text-sm text-muted-foreground">Você já pode acessar sua conta, mas esta área só exibirá notas, frequência, disciplinas e atividades depois que a escola vincular você a uma turma.</p><Button className="mt-4" variant="outline" onClick={() => void student.refetch()}>Verificar vínculo novamente</Button></div></AcademicShell>;
  }

  if (activeQuery.isPending) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6">Carregando dados...</div></AcademicShell>;
  }

  if (activeQuery.error) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6"><p className="text-sm text-destructive">{errorText(activeQuery.error)}</p><Button className="mt-4" variant="outline" onClick={() => void activeQuery.refetch()}>Tentar novamente</Button></div></AcademicShell>;
  }

  return (
    <AcademicShell title={title.title} subtitle={title.subtitle}>


      {module === "tarefas" && (
        <section className="mt-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Atividades</p>
              <h2 className="mt-1 text-xl font-semibold">Tarefas organizadas por disciplina e professor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Você sempre consegue identificar quem publicou a atividade e a qual matéria ela pertence.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{pendingTasks.length} pendente{pendingTasks.length === 1 ? "" : "s"}</span>
              {overdueTasks.length > 0 && <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">{overdueTasks.length} atrasada{overdueTasks.length === 1 ? "" : "s"}</span>}
            </div>
          </div>

          <div className="sina-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Filtrar por matéria</p>
              <p className="mt-1 text-xs text-muted-foreground">A lista continua separada por professor.</p>
            </div>
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:min-w-64"
            >
              <option value="all">Todas as matérias</option>
              {Array.from(new Set((tasks.data ?? []).map((task) => task.subject_name || task.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")).map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {taskGroups.length ? taskGroups.map((group) => (
            <section key={group.subject + group.teacherId} className="space-y-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold">{group.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Turma {group.classroom} · Professor {group.teacher}</p>
                </div>
                <span className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold">{group.tasks.filter((task) => !task.completed).length} pendente{group.tasks.filter((task) => !task.completed).length === 1 ? "" : "s"}</span>
              </div>
              {group.tasks.map((task) => {
                const submission = submissions.data?.find((item) => item.task_id === task.id);
                return (
                  <article key={task.id} className="sina-card p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Professor {task.teacher_name || "não identificado"} · {task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p>
                        {task.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{submission?.status === "graded" ? "Corrigida" : task.completed ? "Concluída" : "Pendente"}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[11px] font-semibold uppercase text-muted-foreground">Disciplina</p><p className="mt-1 text-xs">{group.subject}</p></div>
                      <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[11px] font-semibold uppercase text-muted-foreground">Professor</p><p className="mt-1 text-xs">{group.teacher}</p></div>
                      <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[11px] font-semibold uppercase text-muted-foreground">Prazo</p><p className="mt-1 text-xs">{task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p></div>
                    </div>
                    {task.attachment_url && <a href={task.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline"><ClipboardCheck className="size-4" />{task.attachment_name || "Abrir anexo da atividade"}</a>}
                    <div className="mt-4 space-y-2">
                      <textarea value={drafts[task.id] ?? submission?.content ?? ""} onChange={(e) => setDrafts((v) => ({...v, [task.id]: e.target.value}))} placeholder="Digite sua resposta ou observação..." className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"/>
                      <Button onClick={() => void sendTask(task.id)} disabled={sending === task.id}>{sending === task.id ? "Enviando..." : submission ? "Atualizar entrega" : "Enviar entrega"}</Button>
                      {submission?.feedback && <p className="text-sm text-muted-foreground">Feedback: {submission.feedback}</p>}
                    </div>
                  </article>
                );
              })}
            </section>
          )) : <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhuma atividade cadastrada ainda. Quando um professor publicar uma atividade para sua turma, ela aparecerá aqui.</div>}
        </section>
      )}

      {module === "disciplinas" && (
        <section className="mt-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Grade acadêmica</p>
            <h2 className="mt-1 text-xl font-semibold">Suas disciplinas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada matéria aparece junto do professor responsável. Uma turma pode ter vários professores e todos ficam separados aqui.</p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Matérias</p><p className="mt-1 text-2xl font-semibold">{studentSubjects.data?.length ?? 0}</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Professores</p><p className="mt-1 text-2xl font-semibold">{new Set((studentSubjects.data ?? []).map((item) => item.teacher_id)).size}</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Turma</p><p className="mt-1 text-2xl font-semibold">{student.data.classroom || "—"}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(studentSubjects.data ?? []).map((item) => {
              const performance = subjects.find((s) => s.subject === item.name);
              const subjectKey = item.id + "::" + item.teacher_id;
              const isSelected = selectedSubjectKey === subjectKey;
              const relatedTasks = (tasks.data ?? []).filter((task) =>
                (task.subject_id && task.subject_id === item.id) ||
                (!task.subject_id && (task.subject_name || task.subject) === item.name),
              );
              return <button key={subjectKey} type="button" onClick={() => setSelectedSubjectKey(isSelected ? null : subjectKey)}
                className={isSelected ? "sina-card border-primary/50 bg-primary/5 p-5 text-left shadow-md" : "sina-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5"/></div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">${relatedTasks.filter(t => !t.completed).length} pend.</span>
                </div>
                <h2 className="mt-4 font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.classroom_name}</p>
                <div className="mt-3 rounded-xl border border-primary/10 bg-primary/5 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Professor responsável</p>
                  <p className="mt-1 text-sm font-semibold">{item.teacher_name || "Professor não informado"}</p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">${performance ? ' + 'performance.periods + " lançamento(s) · " + performance.absences + " falta(s)"' + ' : "Nenhuma nota lançada ainda."}</p>
                <p className="mt-4 text-xs font-semibold text-primary">{isSelected ? "Fechar detalhes" : "Abrir detalhes da disciplina"} →</p>
              </button>;
            })}
          </div>
          {!studentSubjects.isPending && !studentSubjects.data?.length && <div className="sina-card p-8 text-sm text-muted-foreground">Nenhuma disciplina vinculada ainda. Assim que a escola ou o professor fizer o vínculo, ela aparecerá aqui.</div>}          {selectedSubjectKey && (() => {
            const selected = (studentSubjects.data ?? []).find((item) => item.id + "::" + item.teacher_id === selectedSubjectKey);
            if (!selected) return null;
            const performance = subjects.find((s) => s.subject === selected.name);
            const selectedTasks = (tasks.data ?? []).filter((task) =>
              (task.subject_id && task.subject_id === selected.id) ||
              (!task.subject_id && (task.subject_name || task.subject) === selected.name),
            );
            const selectedAssessments = (assessments.data ?? []).filter((item) =>
              item.subject_id === selected.id && item.teacher_id === selected.teacher_id,
            );
            const selectedAttendance = (attendance.data ?? []).filter((row) =>
              row.subject_id === selected.id && row.teacher_id === selected.teacher_id,
            );
            return <section className="mt-5 sina-card overflow-hidden border-primary/20">
              <div className="bg-primary/5 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Detalhes da disciplina</p>
                <h3 className="mt-1 font-display text-2xl font-bold">{selected.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Turma {selected.classroom_name} · Professor {selected.teacher_name || "não informado"}</p>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Média</p><p className="mt-1 text-2xl font-semibold">${performance?.average == null ? "—" : formatScore(performance.average)}</p></div>
                <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Notas</p><p className="mt-1 text-2xl font-semibold">${performance?.periods ?? 0}</p></div>
                <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Atividades</p><p className="mt-1 text-2xl font-semibold">${selectedTasks.length}</p></div>
                <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Frequência</p><p className="mt-1 text-2xl font-semibold">${selectedAttendance.length}</p></div>
              </div>
              <div className="grid gap-5 border-t border-border p-5 lg:grid-cols-3">
                <div>
                  <h4 className="font-semibold">Notas recentes</h4>
                  <div className="mt-3 space-y-2">
                    {(grades.data ?? []).filter(g => g.subject === selected.name).slice(0,4).map(g =>
                      <div key={g.id} className="rounded-xl border border-border p-3"><div className="flex justify-between text-sm"><span>${g.period}º período</span><b>${formatScore(g.score)}</b></div><p className="mt-1 text-xs text-muted-foreground">${g.absences} falta(s)</p></div>
                    )}
                    {!(grades.data ?? []).some(g => g.subject === selected.name) && <p className="text-sm text-muted-foreground">Sem notas lançadas.</p>}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Atividades</h4>
                  <div className="mt-3 space-y-2">
                    {selectedTasks.slice(0,4).map(task => <div key={task.id} className="rounded-xl border border-border p-3"><p className="truncate text-sm font-semibold">${task.title}</p><p className="mt-1 text-xs text-muted-foreground">${task.completed ? "Concluída" : "Pendente"} · ${task.due_at ? new Date(task.due_at).toLocaleDateString("pt-BR") : "Sem prazo"}</p></div>)}
                    {!selectedTasks.length && <p className="text-sm text-muted-foreground">Nenhuma atividade nesta disciplina.</p>}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Frequência</h4>
                  <div className="mt-3 space-y-2">
                    {selectedAttendance.slice(0,4).map(row => <div key={row.attendance_date + row.teacher_id + row.status} className="rounded-xl border border-border p-3"><div className="flex justify-between gap-3 text-sm"><span>${new Date(row.attendance_date + "T12:00:00").toLocaleDateString("pt-BR")}</span><b>${row.status === "absent" ? "Falta" : row.status === "late" ? "Atrasado" : row.status === "excused" ? "Justificada" : "Presente"}</b></div>{row.note && <p className="mt-1 text-xs text-muted-foreground">${row.note}</p>}</div>)}
                    {!selectedAttendance.length && <p className="text-sm text-muted-foreground">Sem registros de frequência nesta disciplina.</p>}
                  </div>
                </div>
              </div>
              {selectedAssessments.length > 0 && <div className="border-t border-border p-5"><h4 className="font-semibold">Avaliações</h4><div className="mt-3 grid gap-3 md:grid-cols-2">${selectedAssessments.slice(0,4).map(item => <div key={item.id} className="rounded-xl border border-border p-3"><div className="flex justify-between gap-3 text-sm"><span className="font-medium">}item.title${</span><b>}item.score == null ? "Sem nota" : item.score + " / " + item.max_score${</b></div><p className="mt-1 text-xs text-muted-foreground">Peso }item.weight${ · }item.teacher_name${</p></div>)}</div></div>}
            </section>;
          })()}

        </section>
      )}

      {module === "notas" && (
        <section className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p>
            <h2 className="mt-1 text-xl font-semibold">Média geral por disciplina</h2>
            <p className="mt-1 text-sm text-muted-foreground">A média geral agora começa pela visão das disciplinas. Clique em uma matéria para ir à área de disciplinas e acompanhar o restante dos detalhes.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(studentSubjects.data ?? []).map((item) => {
              const performance = subjects.find((s) => s.subject === item.name);
              return <Link key={item.id + item.teacher_id} to="/aluno/disciplinas" className="sina-card group p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="size-5"/></span>
                  <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/>
                </div>
                <h3 className="mt-4 font-semibold">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Prof. {item.teacher_name || "não informado"}</p>
                <p className="mt-3 font-display text-3xl font-semibold">{performance?.average == null ? "—" : formatScore(performance.average)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{performance ? performance.periods + " lançamento(s)" : "Ainda sem lançamento"}</p>
                <p className="mt-3 text-xs font-semibold text-primary">Abrir detalhes →</p>
              </Link>;
            })}
            {!studentSubjects.data?.length && <div className="sina-card p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Nenhuma disciplina vinculada ainda.</div>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Lançamentos</p><p className="mt-1 text-2xl font-semibold">{grades.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">notas por período</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Avaliações</p><p className="mt-1 text-2xl font-semibold">{assessments.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">provas e trabalhos</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Com nota</p><p className="mt-1 text-2xl font-semibold">{(assessments.data ?? []).filter(item => item.score != null).length}</p><p className="mt-1 text-xs text-muted-foreground">avaliações corrigidas</p></div>
          </div>

          <div className="sina-card overflow-hidden">
            <div className="border-b border-border p-5"><h3 className="font-semibold">Lançamentos por disciplina</h3><p className="mt-1 text-xs text-muted-foreground">O professor da matéria fica identificado na mesma linha.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-4 text-left">Disciplina</th><th className="p-4 text-left">Professor</th><th className="p-4 text-left">Período</th><th className="p-4 text-left">Nota</th><th className="p-4 text-left">Faltas</th></tr></thead><tbody>
              {(grades.data ?? []).map((g) => {
                const teachers = gradeTeachers(g);
                return <tr key={g.id} className="border-t border-border">
                  <td className="p-4 font-medium">{g.subject}</td>
                  <td className="p-4 text-xs text-muted-foreground">{teachers.length ? teachers.join(", ") : "Professor não informado"}</td>
                  <td className="p-4">{g.period}º</td>
                  <td className="p-4 font-semibold">{formatScore(g.score)}</td>
                  <td className="p-4">{g.absences}</td>
                </tr>;
              })}
            </tbody></table>{!grades.data?.length && <p className="p-6 text-sm text-muted-foreground">Nenhum lançamento de período ainda.</p>}</div>
          </div>

          <div>
            <div className="mb-3"><h3 className="font-semibold">Avaliações por disciplina e professor</h3><p className="mt-1 text-xs text-muted-foreground">Cada grupo identifica a matéria, o professor e os resultados das avaliações.</p></div>
            <div className="space-y-4">
              {assessmentGroups.map((group) => (
                <section key={group.subject + group.teacher} className="sina-card overflow-hidden">
                  <div className="flex flex-col gap-2 border-b border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><h4 className="font-semibold">{group.subject}</h4><p className="mt-1 text-xs text-muted-foreground">Professor {group.teacher} · {group.classroom}</p></div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{group.items.length} avaliação{group.items.length === 1 ? "" : "ões"}</span>
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {group.items.map((item) => <article key={item.id} className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.term_name || "Período não informado"} · {item.assessment_type || "Avaliação"}</p></div><strong className="shrink-0">{item.score == null ? "Sem nota" : item.score + " / " + item.max_score}</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Peso: <b className="text-foreground">{item.weight}</b></span><span>Prazo: <b className="text-foreground">{item.due_at ? new Date(item.due_at).toLocaleString("pt-BR") : "Não definido"}</b></span><span>Status: <b className="text-foreground">{item.score == null ? "Aguardando correção" : "Corrigida"}</b></span><span>Professor: <b className="text-foreground">{item.teacher_name}</b></span></div>{item.feedback && <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm"><b>Feedback:</b> {item.feedback}</div>}</article>)}
                  </div>
                </section>
              ))}
              {!assessmentGroups.length && <div className="sina-card p-6 text-sm text-muted-foreground">Nenhuma avaliação cadastrada para você ainda.</div>}
            </div>
          </div>
        </section>
      )}

      {module === "frequencia" && (
        <section className="mt-6 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Diário acadêmico</p>
              <h2 className="mt-1 text-xl font-semibold">Frequência detalhada por disciplina</h2>
              <p className="mt-1 text-sm text-muted-foreground">Data, disciplina, professor, turma, situação e observação aparecem juntos em cada registro.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{attendance.data?.length ?? 0} registro{attendance.data?.length === 1 ? "" : "s"}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sina-card p-4"><Clock3 className="size-4 text-primary"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Registros</p><p className="mt-1 text-2xl font-semibold">{attendanceSummary.total}</p></div>
            <div className="sina-card p-4"><CheckCircle2 className="size-4 text-success"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Presenças</p><p className="mt-1 text-2xl font-semibold">{attendanceSummary.present}</p></div>
            <div className="sina-card p-4"><AlertTriangle className="size-4 text-destructive"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Faltas</p><p className="mt-1 text-2xl font-semibold">{attendanceSummary.absent}</p></div>
            <div className="sina-card p-4"><UserRound className="size-4 text-warning"/><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Atrasos</p><p className="mt-1 text-2xl font-semibold">{attendanceSummary.late}</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Frequência</p><p className="mt-1 text-2xl font-semibold">{attendanceSummary.percentage == null ? "—" : attendanceSummary.percentage + "%"}</p><p className="mt-1 text-[11px] text-muted-foreground">presenças ÷ registros disponíveis</p></div>
          </div>

          <div className="sina-card overflow-hidden">
            <div className="border-b border-border p-5">
              <h3 className="font-semibold">Histórico completo</h3>
              <p className="mt-1 text-xs text-muted-foreground">Use esta tabela como seu histórico oficial de acompanhamento.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-4 text-left">Data</th>
                    <th className="p-4 text-left">Disciplina</th>
                    <th className="p-4 text-left">Professor</th>
                    <th className="p-4 text-left">Turma</th>
                    <th className="p-4 text-left">Situação</th>
                    <th className="p-4 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance.data ?? []).map((item, index) => (
                    <tr key={item.attendance_date + item.teacher_id + index} className="border-t border-border">
                      <td className="p-4 whitespace-nowrap">{new Date(item.attendance_date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="p-4 font-medium">{item.subject_name || "Disciplina não identificada"}</td>
                      <td className="p-4 text-xs text-muted-foreground">{item.teacher_name}</td>
                      <td className="p-4 text-xs text-muted-foreground">{item.classroom_name}</td>
                      <td className="p-4">
                        <span className={item.status === "absent" ? "rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive" : item.status === "late" ? "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300" : "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"}>
                          {item.status === "absent" ? "Falta" : item.status === "late" ? "Atrasado" : item.status === "excused" ? "Justificada" : "Presente"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{item.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!attendance.data?.length && <p className="p-8 text-center text-sm text-muted-foreground">Ainda não há registros de frequência para exibir.</p>}
            </div>
          </div>
        </section>
      )}
      {module === "agenda" && (
        <section className="mt-6 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Planejamento</p><h2 className="mt-1 text-xl font-semibold">Agenda acadêmica</h2><p className="mt-1 text-sm text-muted-foreground">Cada evento informa sua origem, turma, tipo e horário.</p></div>
          {(calendar.data ?? []).map((event) => <article key={event.id} className="sina-card p-5"><div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{event.title}</p><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{event.event_type}</span></div><div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><span>Quando: {new Date(event.start_at).toLocaleString("pt-BR")}</span><span>Origem: {event.classroom_name ? "Turma " + event.classroom_name : "Institucional"}</span></div>{event.description && <p className="mt-3 text-sm text-muted-foreground">{event.description}</p>}</div></div></article>)}
          {!calendar.data?.length && <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhum evento próximo. Quando houver aulas, provas ou compromissos, eles aparecerão aqui.</div>}
        </section>
      )}

      {module === "avisos" && (
        <section className="mt-6 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Comunicação</p><h2 className="mt-1 text-xl font-semibold">Avisos por professor</h2><p className="mt-1 text-sm text-muted-foreground">Cada comunicado mostra claramente quem publicou e para qual turma.</p></div>
          {(announcements.data ?? []).length ? (announcements.data ?? []).map((item) => <article key={item.id} className="sina-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-5"/></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs font-semibold text-primary">Professor {item.teacher_name}</p></div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{item.classroom_name || "Institucional"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Publicado em {new Date(item.created_at).toLocaleString("pt-BR")}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
                {item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-primary underline">Abrir anexo</a>}
              </div>
            </div>
          </article>) : <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhum aviso novo. Os comunicados da escola e dos professores aparecerão aqui.</div>}
        </section>
      )}

    </AcademicShell>
  );
}
