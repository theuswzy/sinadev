import { useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  errorText,
  loadStudentAssessments,
  loadStudentAttendance,
  loadStudentCalendar,
  loadStudentTaskSubmissions,
  loadTasks,
  submitTask,
} from "@/lib/sina-data";

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString();
}

function monthEnd() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function StudentAcademicCenter() {
  const tasks = useQuery({ queryKey: ["student-academic-tasks-center"], queryFn: loadTasks });
  const assessments = useQuery({ queryKey: ["student-assessments"], queryFn: loadStudentAssessments });
  const attendance = useQuery({ queryKey: ["student-attendance-history"], queryFn: loadStudentAttendance });
  const calendar = useQuery({ queryKey: ["student-calendar-center"], queryFn: () => loadStudentCalendar(monthStart(), monthEnd()) });
  const submissions = useQuery({ queryKey: ["student-task-submissions"], queryFn: loadStudentTaskSubmissions });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  async function send(taskId: string) {
    setSending(taskId);
    try {
      await submitTask(taskId, drafts[taskId] ?? "");
      setDrafts(prev => ({ ...prev, [taskId]: "" }));
      await submissions.refetch();
      toast.success("Atividade enviada para correção.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(null);
    }
  }

  return (
    <section id="academico" className="mt-6 scroll-mt-28 space-y-5">
      <div className="rounded-3xl border border-primary/15 bg-primary/5 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Minha vida acadêmica</p>
        <h2 className="mt-1 font-display text-2xl font-bold">Atividades, avaliações, frequência e agenda</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Tudo que você precisa acompanhar fica reunido em uma única área.</p>
      </div>

      <div className="sina-card p-6">
        <div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Entregas</p><h3 className="font-semibold">Minhas atividades</h3></div></div>
        <div className="mt-4 space-y-3">
          {(tasks.data ?? []).length ? (tasks.data ?? []).map(task => {
            const submission = submissions.data?.find(item => item.task_id === task.id);
            return (
              <article key={task.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0"><p className="font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.due_at ? `Entrega ${new Date(task.due_at).toLocaleString("pt-BR")}` : "Sem prazo"}</p>{task.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}</div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${submission?.status === "graded" ? "bg-primary/10 text-primary" : task.completed ? "bg-secondary text-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{submission?.status === "graded" ? "Corrigida" : task.completed ? "Concluída" : "Pendente"}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <textarea value={drafts[task.id] ?? submission?.content ?? ""} onChange={e => setDrafts(prev => ({ ...prev, [task.id]: e.target.value }))} placeholder="Escreva sua resposta, observação ou link da entrega..." className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <div className="flex flex-wrap items-center gap-2"><Button onClick={() => void send(task.id)} disabled={sending === task.id}>{sending === task.id ? "Enviando…" : submission ? "Atualizar entrega" : "Enviar entrega"}</Button>{submission?.score != null && <span className="text-sm font-semibold text-primary">Nota: {submission.score}</span>}{submission?.feedback && <span className="text-sm text-muted-foreground">· {submission.feedback}</span>}</div>
                </div>
              </article>
            );
          }) : <p className="text-sm text-muted-foreground">Nenhuma atividade disponível no momento.</p>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="sina-card p-6">
          <div className="flex items-center gap-3"><FileText className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Avaliações</p><h3 className="font-semibold">Notas por avaliação</h3></div></div>
          <div className="mt-4 space-y-2">{(assessments.data ?? []).length ? (assessments.data ?? []).map(item => <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">peso {item.weight}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.subject_name} {item.term_name ? `· ${item.term_name}` : ""}</p><div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{item.score == null ? <span className="text-muted-foreground">Ainda sem nota</span> : <span className="font-bold text-primary">{item.score.toLocaleString("pt-BR")} / {item.max_score}</span>}{item.feedback && <span className="text-muted-foreground">{item.feedback}</span>}</div></div>) : <p className="text-sm text-muted-foreground">Nenhuma avaliação publicada.</p>}</div>
        </div>

        <div className="sina-card p-6">
          <div className="flex items-center gap-3"><Clock3 className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Frequência</p><h3 className="font-semibold">Histórico recente</h3></div></div>
          <div className="mt-4 space-y-2">{(attendance.data ?? []).slice(0, 12).map(item => <div key={item.attendance_date} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold">{new Date(item.attendance_date + "T12:00:00").toLocaleDateString("pt-BR")}</p><p className="text-xs text-muted-foreground">{item.classroom}{item.note ? ` · ${item.note}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "absent" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{item.status === "absent" ? "Falta" : item.status === "late" ? "Atrasado" : item.status === "excused" ? "Justificada" : "Presente"}</span></div>)}{!attendance.data?.length && <p className="text-sm text-muted-foreground">A frequência detalhada aparecerá aqui.</p>}</div>
        </div>
      </div>

      <div className="sina-card p-6">
        <div className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Agenda</p><h3 className="font-semibold">Compromissos do mês</h3></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{(calendar.data ?? []).map(event => <div key={event.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{event.title}</p><span className="text-[11px] font-semibold text-primary">{event.event_type}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.classroom_name ?? "Institucional"} · {new Date(event.start_at).toLocaleString("pt-BR")}</p>{event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}</div>)}{!calendar.data?.length && <p className="text-sm text-muted-foreground">Nenhum compromisso neste mês.</p>}</div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-primary" />As entregas e correções ficam registradas no seu histórico acadêmico.</div>
    </section>
  );
}
