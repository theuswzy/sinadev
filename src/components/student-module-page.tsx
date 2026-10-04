import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Megaphone, BookOpen } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  errorText,
  formatScore,
  loadGrades,
  loadMyStudent,
  loadStudentAssessments,
  loadStudentAttendance,
  loadStudentCalendar,
  loadStudentTaskSubmissions,
  loadTasks,
  loadAnnouncements,
  loadStudentSubjects,
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
  const tasks = useQuery({ queryKey: ["student-module-tasks"], queryFn: loadTasks, enabled: module === "tarefas" });
  const studentSubjects = useQuery({ queryKey: ["student-module-subjects"], queryFn: loadStudentSubjects, enabled: module === "disciplinas" });
  const grades = useQuery({ queryKey: ["student-module-grades", student.data?.id], queryFn: () => loadGrades(student.data?.id ?? ""), enabled: !!student.data?.id && (module === "disciplinas" || module === "notas") });
  const assessments = useQuery({ queryKey: ["student-module-assessments"], queryFn: loadStudentAssessments, enabled: module === "notas" });
  const attendance = useQuery({ queryKey: ["student-module-attendance"], queryFn: loadStudentAttendance, enabled: module === "frequencia" });
  const announcements = useQuery({ queryKey: ["student-module-announcements"], queryFn: loadAnnouncements, enabled: module === "avisos" });
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

  const subjects = useMemo(() => {
    const rows = grades.data ?? [];
    return Array.from(new Set(rows.map((g) => g.subject))).map((subject) => {
      const items = rows.filter((g) => g.subject === subject);
      return {
        subject,
        average: items.reduce((sum, item) => sum + item.score, 0) / items.length,
        absences: items.reduce((sum, item) => sum + item.absences, 0),
        periods: items.length,
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

  if (student.error || !student.data) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6 text-sm text-destructive">{errorText(student.error ?? new Error("Perfil acadêmico não encontrado."))}</div></AcademicShell>;
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
        <section className="mt-6 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Atividades</p><h2 className="mt-1 text-xl font-semibold">Suas tarefas e entregas</h2><p className="mt-1 text-sm text-muted-foreground">Abra uma atividade, responda e acompanhe a correção.</p></div>
            <span className="hidden rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold sm:inline-flex">{pendingTasks.length} pendente{pendingTasks.length === 1 ? "" : "s"}</span>
          </div>
          {(tasks.data ?? []).length ? (tasks.data ?? []).map((task) => {
            const submission = submissions.data?.find((item) => item.task_id === task.id);
            return (
              <article key={task.id} className="sina-card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div><p className="font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p>{task.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}</div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{submission?.status === "graded" ? "Corrigida" : task.completed ? "Concluída" : "Pendente"}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <textarea value={drafts[task.id] ?? submission?.content ?? ""} onChange={(e) => setDrafts((v) => ({...v, [task.id]: e.target.value}))} placeholder="Digite sua resposta ou observação..." className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"/>
                  <Button onClick={() => void sendTask(task.id)} disabled={sending === task.id}>{sending === task.id ? "Enviando..." : submission ? "Atualizar entrega" : "Enviar entrega"}</Button>
                  {submission?.feedback && <p className="text-sm text-muted-foreground">Feedback: {submission.feedback}</p>}
                </div>
              </article>
            );
          }) : <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhuma atividade cadastrada ainda. Quando um professor publicar uma atividade para sua turma, ela aparecerá aqui.</div>}
        </section>
      )}

      {module === "disciplinas" && (
        <section className="mt-6">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wide text-primary">Grade acadêmica</p><h2 className="mt-1 text-xl font-semibold">Suas disciplinas</h2><p className="mt-1 text-sm text-muted-foreground">Veja as disciplinas, turmas e professores vinculados a você.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(studentSubjects.data ?? []).map((item) => {
              const performance = subjects.find((s) => s.subject === item.name);
              return <article key={item.id + item.classroom_id} className="sina-card p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5"/></div>
                <h2 className="mt-4 font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.classroom_name} · {item.teacher_name || "Professor não informado"}</p>
                <p className="mt-3 text-xs text-muted-foreground">{performance ? `${performance.periods} lançamento(s) · ${performance.absences} falta(s)` : "Nenhuma nota lançada ainda."}</p>
                {performance && <><div className="mt-4 flex items-end justify-between"><span className="text-xs text-muted-foreground">Média</span><strong className="text-2xl">{formatScore(performance.average)}</strong></div><div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width: `${Math.min(100, performance.average * 10)}%`}}/></div></>}
              </article>;
            })}
          </div>
          {!studentSubjects.isPending && !studentSubjects.data?.length && <div className="sina-card p-8 text-sm text-muted-foreground">Nenhuma disciplina vinculada ainda. Assim que a escola ou o professor fizer o vínculo, ela aparecerá aqui.</div>}
        </section>
      )}
      {module === "notas" && (
        <section className="mt-6 space-y-5">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p><h2 className="mt-1 text-xl font-semibold">Notas e avaliações</h2><p className="mt-1 text-sm text-muted-foreground">Aqui você vê não só a nota final lançada, mas também a origem de cada resultado.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Lançamentos</p><p className="mt-1 text-2xl font-semibold">{grades.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">notas registradas por período</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Avaliações</p><p className="mt-1 text-2xl font-semibold">{assessments.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">provas, trabalhos e outras avaliações</p></div>
            <div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Com nota</p><p className="mt-1 text-2xl font-semibold">{(assessments.data ?? []).filter(item => item.score != null).length}</p><p className="mt-1 text-xs text-muted-foreground">avaliações já corrigidas</p></div>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm"><p className="font-semibold">Como suas notas são formadas</p><p className="mt-1 text-muted-foreground">“Lançamentos” são registros de nota por período feitos pelo professor. “Avaliações” são provas, trabalhos ou atividades cadastradas separadamente, com peso e nota própria. Assim você consegue identificar de onde cada resultado veio.</p></div>
          <div className="sina-card overflow-hidden">
            <div className="border-b border-border p-5"><h3 className="font-semibold">Lançamentos por período</h3><p className="mt-1 text-xs text-muted-foreground">Fonte: registro acadêmico do professor.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-4 text-left">Disciplina</th><th className="p-4 text-left">Período</th><th className="p-4 text-left">Nota</th><th className="p-4 text-left">Faltas</th><th className="p-4 text-left">Origem</th></tr></thead><tbody>
              {(grades.data ?? []).map((g) => <tr key={g.id} className="border-t border-border"><td className="p-4 font-medium">{g.subject}</td><td className="p-4">{g.period}º</td><td className="p-4 font-semibold">{formatScore(g.score)}</td><td className="p-4">{g.absences}</td><td className="p-4 text-xs text-muted-foreground">Professor · lançamento do período</td></tr>)}
            </tbody></table>{!grades.data?.length && <p className="p-6 text-sm text-muted-foreground">Nenhum lançamento de período ainda.</p>}</div>
          </div>
          <div><div className="mb-3"><h3 className="font-semibold">Avaliações que explicam o desempenho</h3><p className="mt-1 text-xs text-muted-foreground">Cada item mostra disciplina, período, tipo, peso, prazo e nota recebida.</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              {(assessments.data ?? []).map((item) => <article key={item.id} className="sina-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.subject_name} · {item.term_name || "Período não informado"}</p></div><strong className="shrink-0">{item.score == null ? "Sem nota" : item.score + " / " + item.max_score}</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Tipo: <b className="text-foreground">{item.assessment_type || "Avaliação"}</b></span><span>Peso: <b className="text-foreground">{item.weight}</b></span><span>Prazo: <b className="text-foreground">{item.due_at ? new Date(item.due_at).toLocaleString("pt-BR") : "Não definido"}</b></span><span>Status: <b className="text-foreground">{item.score == null ? "Aguardando correção" : "Corrigida"}</b></span></div>{item.feedback && <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm"><b>Feedback:</b> {item.feedback}</div>}</article>)}
              {!assessments.data?.length && <div className="sina-card p-6 text-sm text-muted-foreground">Nenhuma avaliação cadastrada para você ainda.</div>}
            </div>
          </div>
        </section>
      )}

      {module === "frequencia" && (
        <section className="mt-6 space-y-5">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Histórico</p><h2 className="mt-1 text-xl font-semibold">Registro de frequência</h2><p className="mt-1 text-sm text-muted-foreground">Veja exatamente quando a presença foi registrada e qual foi o status.</p></div><span className="hidden rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold sm:inline-flex">{attendance.data?.length ?? 0} registro{attendance.data?.length === 1 ? "" : "s"}</span></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Registros</p><p className="mt-1 text-2xl font-semibold">{attendance.data?.length ?? 0}</p></div><div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Faltas</p><p className="mt-1 text-2xl font-semibold">{attendance.data?.filter(item => item.status === "absent").length ?? 0}</p></div><div className="sina-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Presenças</p><p className="mt-1 text-2xl font-semibold">{attendance.data?.filter(item => item.status === "present").length ?? 0}</p></div></div>
          <div className="sina-card divide-y divide-border">{(attendance.data ?? []).map((item, index) => <div key={item.attendance_date + index} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{new Date(item.attendance_date + "T12:00:00").toLocaleDateString("pt-BR")}</p><p className="text-xs text-muted-foreground">Turma: {item.classroom}{item.note ? " · Observação: " + item.note : ""}</p></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Fonte: diário da turma</span><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{item.status === "absent" ? "Falta" : item.status === "late" ? "Atrasado" : item.status === "excused" ? "Justificada" : "Presente"}</span></div></div>)}</div>
          {!attendance.isPending && !attendance.data?.length && <div className="sina-card p-8 text-center text-sm text-muted-foreground">Ainda não há registros de frequência para exibir.</div>}
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
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Comunicação</p><h2 className="mt-1 text-xl font-semibold">Avisos</h2><p className="mt-1 text-sm text-muted-foreground">Comunicados recebidos, identificando a turma e a data de publicação.</p></div>
          {(announcements.data ?? []).map((item) => <article key={item.id} className="sina-card p-5"><div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{item.classroom || "Institucional"}</span></div><p className="mt-1 text-xs text-muted-foreground">Publicado em {new Date(item.created_at).toLocaleString("pt-BR")} · Fonte: comunicação acadêmica</p><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-primary underline">Abrir anexo</a>}</div></div></article>)}
          {!announcements.data?.length && <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhum aviso novo. Os comunicados da escola e dos professores aparecerão aqui.</div>}
        </section>
      )}
    </AcademicShell>
  );
}
