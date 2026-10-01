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

  if (student.isPending) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6">Carregando...</div></AcademicShell>;
  }

  if (student.error || !student.data) {
    return <AcademicShell title={title.title} subtitle={title.subtitle}><div className="sina-card mt-8 p-6 text-sm text-destructive">{errorText(student.error ?? new Error("Perfil acadêmico não encontrado."))}</div></AcademicShell>;
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
          }) : <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhuma atividade disponível.</div>}
        </section>
      )}

      {module === "disciplinas" && (
        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.length ? subjects.map((item) => (
              <article key={item.subject} className="sina-card p-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5"/></div>
                <h2 className="mt-4 font-semibold">{item.subject}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.periods} lançamento{item.periods === 1 ? "" : "s"} · {item.absences} falta{item.absences === 1 ? "" : "s"}</p>
                <div className="mt-5 flex items-end justify-between"><span className="text-xs text-muted-foreground">Média</span><strong className="text-2xl">{formatScore(item.average)}</strong></div>
                <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width: `${Math.min(100, item.average * 10)}%`}}/></div>
              </article>
            )) : <div className="sina-card p-8 text-sm text-muted-foreground">Nenhuma disciplina com notas registrada ainda.</div>}
          </div>
        </section>
      )}

      {module === "notas" && (
        <section className="mt-6 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Desempenho</p><h2 className="mt-1 text-xl font-semibold">Notas e avaliações</h2><p className="mt-1 text-sm text-muted-foreground">Consulte cada lançamento e o resultado das avaliações.</p></div>
          <div className="sina-card overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-4 text-left">Disciplina</th><th className="p-4 text-left">Período</th><th className="p-4 text-left">Nota</th><th className="p-4 text-left">Faltas</th></tr></thead><tbody>{(grades.data ?? []).map((g) => <tr key={g.id} className="border-t border-border"><td className="p-4 font-medium">{g.subject}</td><td className="p-4">{g.period}º</td><td className="p-4 font-semibold">{formatScore(g.score)}</td><td className="p-4">{g.absences}</td></tr>)}</tbody></table></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">{(assessments.data ?? []).map((item) => <article key={item.id} className="sina-card p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.subject_name} · {item.term_name}</p></div><strong>{item.score == null ? "—" : `${item.score} / ${item.max_score}`}</strong></div>{item.feedback && <p className="mt-3 text-sm text-muted-foreground">{item.feedback}</p>}</article>)}</div>
        </section>
      )}

      {module === "frequencia" && (
        <section className="mt-6 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Histórico</p><h2 className="mt-1 text-xl font-semibold">Registro de frequência</h2><p className="mt-1 text-sm text-muted-foreground">Consulte presença, faltas, atrasos e justificativas por data.</p></div>
            <span className="hidden rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold sm:inline-flex">{attendance.data?.length ?? 0} registro{attendance.data?.length === 1 ? "" : "s"}</span>
          </div>
          <div className="sina-card divide-y divide-border">{(attendance.data ?? []).map((item, index) => <div key={item.attendance_date + index} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{new Date(item.attendance_date + "T12:00:00").toLocaleDateString("pt-BR")}</p><p className="text-xs text-muted-foreground">{item.classroom}{item.note ? ` · ${item.note}` : ""}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{item.status === "absent" ? "Falta" : item.status === "late" ? "Atrasado" : item.status === "excused" ? "Justificada" : "Presente"}</span></div>)}</div>
        </section>
      )}

      {module === "agenda" && (
        <section className="mt-6 space-y-3">
          {(calendar.data ?? []).map((event) => <article key={event.id} className="sina-card p-5"><div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5"/></div><div><p className="font-semibold">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.start_at).toLocaleString("pt-BR")} · {event.classroom_name ?? "Institucional"}</p>{event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}</div></div></article>)}
          {!calendar.data?.length && <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhum evento próximo.</div>}
        </section>
      )}

      {module === "avisos" && (
        <section className="mt-6 space-y-3">
          {(announcements.data ?? []).map((item) => <article key={item.id} className="sina-card p-5"><div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="size-5"/></div><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p></div></div></article>)}
          {!announcements.data?.length && <div className="sina-card p-8 text-center text-sm text-muted-foreground">Nenhum aviso disponível.</div>}
        </section>
      )}
    </AcademicShell>
  );
}
