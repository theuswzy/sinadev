import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardCheck, ClipboardList, FileSpreadsheet, Save, UsersRound, Pencil, Trash2, Paperclip, FileText, Search, Archive, ExternalLink, GraduationCap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAssessment,
  createTeacherCalendarEvent,
  createTeacherTask,
  updateTeacherTask,
  deleteTeacherTask,
  uploadAcademicAttachment,
  loadTeacherSubjectAssignments,
  errorText,
  gradeTaskSubmission,
  loadAttendance,
  loadTeacherAttendanceReport,
  loadTaskSubmissions,
  loadTeacherAcademicOptions,
  loadTeacherAssessments,
  loadTeacherCalendar,
  loadTeacherAcademicMaterials,
  createTeacherAcademicMaterial,
  deleteTeacherAcademicMaterial,
  loadTeacherGradebook,
  saveTeacherGradebook,
  loadTeacherClassReport,
  loadTeacherClassrooms,
  saveAttendance,
  type AttendanceRow,
  type TeacherAssessment,
  type TeacherTask,
  type AcademicMaterial,
} from "@/lib/sina-data";
import { supabase } from "@/integrations/supabase/client";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString();
};
const monthEnd = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export function TeacherAcademicCenter() {
  const qc = useQueryClient();
  const classrooms = useQuery({ queryKey: ["teacher-classrooms"], queryFn: loadTeacherClassrooms });
  const [classroomId, setClassroomId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [attendanceSubjectId, setAttendanceSubjectId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const subjectAssignments = useQuery({ queryKey: ["teacher-subject-assignments-center"], queryFn: loadTeacherSubjectAssignments });
  const classSubjects = (subjectAssignments.data ?? []).filter(item => item.classroom_id === classroomId);
  const attendance = useQuery({
    queryKey: ["teacher-attendance", classroomId, attendanceDate, attendanceSubjectId],
    queryFn: () => loadAttendance(classroomId, attendanceDate, attendanceSubjectId),
    enabled: !!classroomId && !!attendanceSubjectId,
  });
  const attendanceReport = useQuery({
    queryKey: ["teacher-attendance-report", classroomId, attendanceSubjectId],
    queryFn: () => loadTeacherAttendanceReport(classroomId, attendanceSubjectId),
    enabled: !!classroomId && !!attendanceSubjectId,
  });
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, { status: AttendanceRow["status"]; note: string }>>({});
  const classReport = useQuery({ queryKey: ["teacher-class-report", classroomId], queryFn: () => loadTeacherClassReport(classroomId), enabled: !!classroomId });

  useEffect(() => {
    if (!classroomId && classrooms.data?.length) setClassroomId(classrooms.data.find(c => c.status === "active")?.id ?? classrooms.data[0]?.id ?? "");
  }, [classroomId, classrooms.data]);

  useEffect(() => {
    const next: Record<string, { status: AttendanceRow["status"]; note: string }> = {};
    (attendance.data ?? []).forEach(row => { next[row.student_id] = { status: row.status, note: row.note ?? "" }; });
    setAttendanceDraft(next);
  }, [attendance.data]);

  const selectedClass = classrooms.data?.find(c => c.id === classroomId) ?? null;
  const presentCount = Object.values(attendanceDraft).filter(v => v.status === "present" || v.status === "late").length;
  const absentCount = Object.values(attendanceDraft).filter(v => v.status === "absent").length;

  async function saveDay() {
    if (!classroomId || !attendanceSubjectId) {
      toast.error("Selecione a disciplina para registrar a frequência.");
      return;
    }
    try {
      const total = await saveAttendance(classroomId, attendanceDate, attendanceSubjectId, Object.entries(attendanceDraft).map(([student_id, value]) => ({ student_id, ...value })));
      await qc.invalidateQueries({ queryKey: ["teacher-attendance", classroomId, attendanceDate] });
      toast.success(`${total} registros de frequência salvos.`);
    } catch (error) { toast.error(errorText(error)); }
  }

  const options = useQuery({ queryKey: ["teacher-academic-options"], queryFn: loadTeacherAcademicOptions });
  const assessments = useQuery({
    queryKey: ["teacher-assessments", classroomId],
    queryFn: () => loadTeacherAssessments(classroomId),
    enabled: !!classroomId,
  });
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState("prova");
  const [termId, setTermId] = useState("");
  const [weight, setWeight] = useState("1");
  const [maxScore, setMaxScore] = useState("10");
  const [dueAt, setDueAt] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    if (classroomId && !attendanceSubjectId && classSubjects.length) {
      setAttendanceSubjectId(classSubjects[0]?.subject_id ?? "");
    }
    if (classroomId && subjectId && !classSubjects.some(item => item.subject_id === subjectId)) {
      setSubjectId("");
    }
  }, [classroomId, classSubjects, attendanceSubjectId, subjectId]);

  useEffect(() => {
    if (!selectedAssessmentId && assessments.data?.length) setSelectedAssessmentId(assessments.data[0]?.id ?? "");
  }, [selectedAssessmentId, assessments.data]);

  const selectedAssessment: TeacherAssessment | null = assessments.data?.find(a => a.id === selectedAssessmentId) ?? null;
  const [gradeSubjectId, setGradeSubjectId] = useState("");
  const [gradePeriod, setGradePeriod] = useState("1");
  const [gradeDraft, setGradeDraft] = useState<Record<string, { score: string; absences: string }>>({});
  const [gradeSaving, setGradeSaving] = useState(false);
  const gradebook = useQuery({
    queryKey: ["teacher-gradebook", classroomId, gradeSubjectId, gradePeriod],
    queryFn: () => loadTeacherGradebook(classroomId, gradeSubjectId, Number(gradePeriod)),
    enabled: !!classroomId && !!gradeSubjectId,
  });

  useEffect(() => {
    const next: Record<string, { score: string; absences: string }> = {};
    (gradebook.data ?? []).forEach(row => {
      next[row.student_id] = { score: row.score == null ? "" : String(row.score), absences: String(row.absences ?? 0) };
    });
    setGradeDraft(next);
  }, [gradebook.data]);

  useEffect(() => {
    if (classroomId && gradeSubjectId && !classSubjects.some(item => item.subject_id === gradeSubjectId)) setGradeSubjectId("");
  }, [classroomId, classSubjects, gradeSubjectId]);

  async function saveGradebook() {
    if (!classroomId || !gradeSubjectId) { toast.error("Selecione a disciplina para lançar as notas."); return; }
    const invalid = Object.values(gradeDraft).find(value => {
      const score = Number(value.score.replace(",", "."));
      const absences = Number(value.absences);
      return value.score !== "" && (!Number.isFinite(score) || score < 0 || score > 10 || !Number.isInteger(absences) || absences < 0);
    });
    if (invalid) { toast.error("Confira as notas (0 a 10) e as faltas (números inteiros)."); return; }
    const rows = Object.entries(gradeDraft).filter(([, value]) => value.score.trim() !== "").map(([student_id, value]) => ({
      student_id, score: Number(value.score.replace(",", ".")), absences: Number(value.absences || 0),
    }));
    if (!rows.length) { toast.error("Informe pelo menos uma nota antes de salvar."); return; }
    setGradeSaving(true);
    try {
      const saved = await saveTeacherGradebook({ classroomId, subjectId: gradeSubjectId, period: Number(gradePeriod), rows });
      await qc.invalidateQueries({ queryKey: ["teacher-gradebook", classroomId, gradeSubjectId, gradePeriod] });
      toast.success(String(saved) + (saved === 1 ? " nota salva." : " notas salvas."));
    } catch (error) { toast.error(errorText(error)); } finally { setGradeSaving(false); }
  }


  async function createNewAssessment() {
    if (!classroomId || !assessmentTitle.trim()) return;
    try {
      await createAssessment({
        classroomId,
        subjectId: subjectId || null,
        termId: termId || null,
        title: assessmentTitle.trim(),
        type: assessmentType,
        weight: Number(weight.replace(",", ".")),
        maxScore: Number(maxScore.replace(",", ".")),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setAssessmentTitle(""); setDueAt("");
      await qc.invalidateQueries({ queryKey: ["teacher-assessments", classroomId] });
      toast.success("Avaliação criada.");
    } catch (error) { toast.error(errorText(error)); }
  }

  async function saveScores() {
    if (!selectedAssessment) return;
    try {
      const entries = Object.entries(scores).filter(([, value]) => value.trim() !== "");
      for (const [studentId, value] of entries) {
        const { error } = await supabase.rpc("teacher_upsert_assessment_score", {
          _assessment_id: selectedAssessment.id,
          _student_id: studentId,
          _score: Number(value.replace(",", ".")),
          _feedback: feedback[studentId] ?? "",
        });
        if (error) throw error;
      }
      toast.success(`${entries.length} nota${entries.length === 1 ? "" : "s"} salva${entries.length === 1 ? "" : "s"}.`);
    } catch (error) { toast.error(errorText(error)); }
  }

  const tasks = useQuery({
    queryKey: ["teacher-academic-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_list_tasks");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [taskId, setTaskId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskSubjectId, setTaskSubjectId] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskEditingId, setTaskEditingId] = useState<string | null>(null);
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);
  const submissions = useQuery({
    queryKey: ["task-submissions", taskId],
    queryFn: () => loadTaskSubmissions(taskId),
    enabled: !!taskId,
  });
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});

  async function gradeSubmission(id: string) {
    const value = grading[id] ?? { score: "", feedback: "" };
    try {
      await gradeTaskSubmission(id, value.score === "" ? null : Number(value.score.replace(",", ".")), value.feedback);
      await submissions.refetch();
      toast.success("Entrega corrigida.");
    } catch (error) { toast.error(errorText(error)); }
  }

  function resetTaskForm() {
    setTaskEditingId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskSubjectId("");
    setTaskDueAt("");
    setTaskFile(null);
  }

  function startEditTask(task: TeacherTask) {
    setTaskEditingId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    const assignment = classSubjects.find(item => item.subject_name === task.subject);
    setTaskSubjectId(assignment?.subject_id ?? task.subject_id ?? "");
    setTaskDueAt(task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : "");
    setTaskFile(null);
    document.getElementById("atividade-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveTask() {
    if (!classroomId || !taskTitle.trim() || !taskSubjectId) {
      toast.error("Selecione a turma, a disciplina e informe o título da atividade.");
      return;
    }
    const assignment = classSubjects.find(item => item.subject_id === taskSubjectId);
    if (!assignment) {
      toast.error("A disciplina selecionada não está vinculada à turma.");
      return;
    }
    setTaskSaving(true);
    try {
      if (taskEditingId) {
        await updateTeacherTask({
          id: taskEditingId,
          classroom: classroomId,
          subject: assignment.subject_name,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        });
        toast.success("Atividade atualizada.");
      } else {
        const attachment = taskFile ? await uploadAcademicAttachment(taskFile, "tasks") : null;
        await createTeacherTask({
          classroom: classroomId,
          subject: assignment.subject_name,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
          attachment,
        });
        toast.success("Atividade publicada para a turma.");
      }
      resetTaskForm();
      await tasks.refetch();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setTaskSaving(false);
    }
  }

  async function removeTask(id: string) {
    if (!window.confirm("Excluir esta atividade? As entregas vinculadas também serão removidas.")) return;
    try {
      await deleteTeacherTask(id);
      if (taskId === id) setTaskId("");
      await Promise.all([tasks.refetch(), submissions.refetch()]);
      toast.success("Atividade excluída.");
    } catch (error) {
      toast.error(errorText(error));
    }
  }


  const materials = useQuery({
    queryKey: ["teacher-academic-materials"],
    queryFn: loadTeacherAcademicMaterials,
  });
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialSubjectId, setMaterialSubjectId] = useState("");
  const [materialTermId, setMaterialTermId] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialSaving, setMaterialSaving] = useState(false);

  const visibleMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase("pt-BR");
    return (materials.data ?? []).filter(item => {
      if (item.classroom_id !== classroomId) return false;
      if (!query) return true;
      return [item.title, item.description, item.file_name, item.classroom_name, item.subject_name, item.term_name]
        .filter(Boolean)
        .some(value => value!.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [materials.data, classroomId, materialSearch]);

  function resetMaterialForm() {
    setMaterialTitle(""); setMaterialDescription(""); setMaterialSubjectId(""); setMaterialTermId(""); setMaterialFile(null);
  }

  async function publishMaterial() {
    if (!classroomId || !materialTitle.trim() || !materialFile) { toast.error("Informe o título e selecione um arquivo."); return; }
    if (materialSubjectId && !classSubjects.some(item => item.subject_id === materialSubjectId)) { toast.error("A disciplina selecionada não pertence à turma."); return; }
    setMaterialSaving(true);
    try {
      const attachment = await uploadAcademicAttachment(materialFile, "materials");
      await createTeacherAcademicMaterial({ classroomId, subjectId: materialSubjectId || null, termId: materialTermId || null, title: materialTitle.trim(), description: materialDescription.trim(), attachment });
      resetMaterialForm();
      await qc.invalidateQueries({ queryKey: ["teacher-academic-materials"] });
      toast.success("Material publicado para a turma.");
    } catch (error) { toast.error(errorText(error)); } finally { setMaterialSaving(false); }
  }

  async function archiveMaterial(material: AcademicMaterial) {
    if (!window.confirm("Arquivar o material \"" + material.title + "\"? Ele deixará de aparecer para os alunos.")) return;
    try {
      await deleteTeacherAcademicMaterial(material.id);
      await qc.invalidateQueries({ queryKey: ["teacher-academic-materials"] });
      toast.success("Material arquivado.");
    } catch (error) { toast.error(errorText(error)); }
  }
  const calendar = useQuery({
    queryKey: ["teacher-calendar-center"],
    queryFn: () => loadTeacherCalendar(monthStart(), monthEnd()),
  });
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("aula");
  const [eventStart, setEventStart] = useState("");
  const [eventClassroom, setEventClassroom] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  async function createEvent() {
    if (!eventTitle.trim() || !eventStart) return;
    try {
      await createTeacherCalendarEvent({
        classroomId: eventClassroom || null,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        startAt: new Date(eventStart).toISOString(),
        endAt: null,
        eventType,
      });
      setEventTitle(""); setEventDescription(""); setEventStart("");
      await calendar.refetch();
      toast.success("Evento adicionado ao calendário.");
    } catch (error) { toast.error(errorText(error)); }
  }

  const upcoming = useMemo(() => (calendar.data ?? []).slice(0, 8), [calendar.data]);

  if (classrooms.isPending) {
    return <section className="mt-6 sina-card p-6"><p className="text-sm text-muted-foreground">Carregando central acadêmica…</p></section>;
  }

  if (!classrooms.data?.length) {
    return <section className="mt-6 sina-card p-6"><div className="flex items-center gap-3"><UsersRound className="size-5 text-primary" /><div><h2 className="font-semibold">Central da turma</h2><p className="mt-1 text-sm text-muted-foreground">Ainda não há turmas com alunos vinculados. Quando uma turma for vinculada, o diário e as avaliações aparecerão aqui.</p></div></div></section>;
  }

  return (
    <section id="central-turma" className="mt-6 scroll-mt-28 space-y-5">
      <div className="rounded-3xl bg-brand p-6 text-brand-foreground md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Central acadêmica</p><h2 className="mt-1 font-display text-2xl font-bold">Diário, avaliações e calendário</h2><p className="mt-2 max-w-2xl text-sm text-brand-muted">Organize a rotina da turma sem sair da área do professor.</p></div>
          <select value={classroomId} onChange={e => setClassroomId(e.target.value)} className="h-10 rounded-md border border-brand-border bg-brand-panel px-3 text-sm text-brand-foreground">{classrooms.data.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""} · {c.student_count} aluno(s)</option>)}</select>
        </div>
      </div>

      <div className="sina-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Diário de classe</p><h3 className="mt-1 font-semibold">{selectedClass?.name}</h3></div><div className="flex flex-wrap gap-2"><Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} /><select value={attendanceSubjectId} onChange={e => setAttendanceSubjectId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Disciplina</option>{classSubjects.map(s => <option key={s.id} value={s.subject_id}>{s.subject_name}</option>)}</select><Button onClick={() => void saveDay()} disabled={attendance.isFetching || !attendanceSubjectId}><Save className="mr-2 size-4" />Salvar frequência</Button></div></div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{presentCount} presentes/atrasados</span><span className="rounded-full bg-destructive/10 px-3 py-1.5 text-destructive">{absentCount} faltas</span><span className="rounded-full bg-secondary px-3 py-1.5">{attendance.data?.length ?? 0} alunos</span></div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-3 text-left">Aluno</th><th className="p-3 text-left">Matrícula</th><th className="p-3 text-left">Situação</th><th className="p-3 text-left">Observação</th></tr></thead><tbody>{(attendance.data ?? []).map(row => <tr key={row.student_id} className="border-t border-border"><td className="p-3 font-medium">{row.full_name}</td><td className="p-3 text-muted-foreground">{row.enrollment}</td><td className="p-3"><select value={attendanceDraft[row.student_id]?.status ?? row.status} onChange={e => setAttendanceDraft(v => ({ ...v, [row.student_id]: { ...(v[row.student_id] ?? { note: "" }), status: e.target.value as AttendanceRow["status"] } }))} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="present">Presente</option><option value="late">Atrasado</option><option value="absent">Falta</option><option value="excused">Justificada</option></select></td><td className="p-3"><Input value={attendanceDraft[row.student_id]?.note ?? ""} onChange={e => setAttendanceDraft(v => ({ ...v, [row.student_id]: { ...(v[row.student_id] ?? { status: "present" }), note: e.target.value } }))} placeholder="Opcional" /></td></tr>)}</tbody></table></div>
      </div>

      <div className="sina-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Frequência por disciplina</p><h3 className="font-semibold">Resumo dos alunos</h3></div></div><p className="mt-2 text-sm text-muted-foreground">A frequência desta disciplina é vinculada à turma, ao professor, ao aluno e à data de cada lançamento.</p></div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{attendanceReport.data?.length ?? 0} aluno{attendanceReport.data?.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-secondary/50"><tr>
              <th className="p-3 text-left">Aluno</th><th className="p-3 text-left">Matrícula</th><th className="p-3 text-left">Frequência</th><th className="p-3 text-left">Presenças</th><th className="p-3 text-left">Faltas</th><th className="p-3 text-left">Justificadas</th><th className="p-3 text-left">Atrasos</th><th className="p-3 text-left">Último registro</th>
            </tr></thead>
            <tbody>{(attendanceReport.data ?? []).map(item => <tr key={item.student_id} className="border-t border-border">
              <td className="p-3 font-medium">{item.student_name}</td>
              <td className="p-3 text-muted-foreground">{item.enrollment}</td>
              <td className="p-3 font-semibold">{item.attendance_percent == null ? "—" : `${item.attendance_percent.toLocaleString("pt-BR")}%`}</td>
              <td className="p-3">{item.present_count}</td>
              <td className="p-3 text-destructive">{item.absent_count}</td>
              <td className="p-3">{item.excused_count}</td>
              <td className="p-3">{item.late_count}</td>
              <td className="p-3 text-xs text-muted-foreground">{item.last_attendance_date ? new Date(item.last_attendance_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
            </tr>)}</tbody>
          </table>
          {!attendanceReport.data?.length && <p className="p-8 text-center text-sm text-muted-foreground">Selecione uma disciplina vinculada para visualizar o resumo.</p>}
        </div>
      </div>

      <div className="sina-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-3"><FileSpreadsheet className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Relatório da turma</p><h3 className="font-semibold">Visão consolidada</h3></div></div><p className="mt-2 text-sm text-muted-foreground">Frequência, média de notas e quantidade de avaliações por aluno.</p></div>
          <Button variant="outline" onClick={() => {
            const rows = classReport.data ?? [];
            const csv = ["Aluno;Matrícula;Frequência;Média;Avaliações", ...rows.map(item => [item.student_name,item.enrollment,item.attendance_percent == null ? "" : String(item.attendance_percent).replace(".", ","),String(item.grade_average).replace(".", ","),String(item.assessment_count)].join(";"))].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `sina-${selectedClass?.name ?? "turma"}-relatorio.csv`; a.click(); URL.revokeObjectURL(url);
          }} disabled={!classReport.data?.length}><FileSpreadsheet className="mr-2 size-4" />Exportar CSV</Button>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[700px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-3 text-left">Aluno</th><th className="p-3 text-left">Matrícula</th><th className="p-3 text-left">Frequência</th><th className="p-3 text-left">Média</th><th className="p-3 text-left">Avaliações</th></tr></thead><tbody>{(classReport.data ?? []).map(item => <tr key={item.student_id} className="border-t border-border"><td className="p-3 font-medium">{item.student_name}</td><td className="p-3 text-muted-foreground">{item.enrollment}</td><td className="p-3">{item.attendance_percent == null ? "—" : `${item.attendance_percent.toLocaleString("pt-BR")}%`}</td><td className="p-3 font-semibold">{item.grade_average ? item.grade_average.toLocaleString("pt-BR") : "—"}</td><td className="p-3">{item.assessment_count}</td></tr>)}</tbody></table></div>
      </div>

      <div className="sina-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-3"><GraduationCap className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Notas</p><h3 className="font-semibold">Diário de notas</h3></div></div><p className="mt-2 text-sm text-muted-foreground">Lance a nota e as faltas por aluno, disciplina e período.</p></div>
          <div className="flex flex-wrap gap-2">
            <select value={gradeSubjectId} onChange={e => setGradeSubjectId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Disciplina</option>{classSubjects.map(s => <option key={s.id} value={s.subject_id}>{s.subject_name}</option>)}</select>
            <select value={gradePeriod} onChange={e => setGradePeriod(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{[1,2,3,4].map(period => <option key={period} value={period}>{period}º período</option>)}</select>
          </div>
        </div>
        {!gradeSubjectId ? <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Selecione uma disciplina para abrir o diário de notas.</div> :
          gradebook.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando diário…</p> :
          gradebook.isError ? <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar o diário desta disciplina.</div> :
          <>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-3 text-left">Aluno</th><th className="p-3 text-left">Matrícula</th><th className="w-36 p-3 text-left">Nota</th><th className="w-36 p-3 text-left">Faltas</th></tr></thead><tbody>
              {(gradebook.data ?? []).map(row => { const value = gradeDraft[row.student_id] ?? { score: row.score == null ? "" : String(row.score), absences: String(row.absences ?? 0) }; return <tr key={row.student_id} className="border-t border-border"><td className="p-3 font-medium">{row.full_name}</td><td className="p-3 text-muted-foreground">{row.enrollment}</td><td className="p-3"><Input type="number" min="0" max="10" step="0.1" placeholder="0–10" value={value.score} onChange={e => setGradeDraft(v => ({ ...v, [row.student_id]: { ...value, score: e.target.value } }))} /></td><td className="p-3"><Input type="number" min="0" step="1" placeholder="0" value={value.absences} onChange={e => setGradeDraft(v => ({ ...v, [row.student_id]: { ...value, absences: e.target.value } }))} /></td></tr>; })}
            </tbody></table></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{gradebook.data?.length ?? 0} aluno(s) · nota de 0 a 10 · faltas inteiras</p><Button onClick={() => void saveGradebook()} disabled={gradeSaving || gradebook.isFetching || !(gradebook.data?.length)}><Save className="mr-2 size-4" />{gradeSaving ? "Salvando…" : "Salvar notas"}</Button></div>
          </>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="sina-card p-6">
          <div className="flex items-center gap-3"><ClipboardList className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Avaliações</p><h3 className="font-semibold">Criar avaliação</h3></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input className="sm:col-span-2" placeholder="Ex.: Prova de Redes" value={assessmentTitle} onChange={e => setAssessmentTitle(e.target.value)} />
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a disciplina</option>{classSubjects.map(s => <option key={s.id} value={s.subject_id}>{s.subject_name}</option>)}</select>
            <select value={termId} onChange={e => setTermId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem período</option>{(options.data?.terms ?? []).map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · atual" : ""}</option>)}</select>
            <select value={assessmentType} onChange={e => setAssessmentType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="atividade">Atividade</option><option value="recuperacao">Recuperação</option></select>
            <Input type="number" min="0.01" step="0.01" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Peso" />
            <Input type="number" min="0.01" step="0.01" value={maxScore} onChange={e => setMaxScore(e.target.value)} placeholder="Nota máxima" />
            <Input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            <Button className="sm:col-span-2" onClick={() => void createNewAssessment()} disabled={!assessmentTitle.trim()}><ClipboardCheck className="mr-2 size-4" />Criar avaliação</Button>
          </div>
          <div className="mt-5 space-y-2">{(assessments.data ?? []).map(a => <button type="button" key={a.id} onClick={() => setSelectedAssessmentId(a.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedAssessmentId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}><div className="flex items-center justify-between gap-3"><span className="font-medium">{a.title}</span><span className="text-xs text-muted-foreground">peso {a.weight}</span></div><p className="mt-1 text-xs text-muted-foreground">{a.subject_name || "Sem disciplina"} {a.term_name ? `· ${a.term_name}` : ""}</p></button>)}</div>
        </div>

        <div className="sina-card p-6">
          <div className="flex items-center gap-3"><FileSpreadsheet className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Lançamento</p><h3 className="font-semibold">{selectedAssessment?.title ?? "Selecione uma avaliação"}</h3></div></div>
          {selectedAssessment ? <><div className="mt-4 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-3 text-left">Aluno</th><th className="w-28 p-3 text-left">Nota</th><th className="p-3 text-left">Feedback</th></tr></thead><tbody>{(attendance.data ?? []).map(student => <tr key={student.student_id} className="border-t border-border"><td className="p-3 font-medium">{student.full_name}</td><td className="p-3"><Input type="number" min="0" max={selectedAssessment.max_score} step="0.01" value={scores[student.student_id] ?? ""} onChange={e => setScores(v => ({ ...v, [student.student_id]: e.target.value }))} /></td><td className="p-3"><Input value={feedback[student.student_id] ?? ""} onChange={e => setFeedback(v => ({ ...v, [student.student_id]: e.target.value }))} placeholder="Comentário" /></td></tr>)}</tbody></table></div><Button className="mt-4" onClick={() => void saveScores()}><Save className="mr-2 size-4" />Salvar notas preenchidas</Button></> : <p className="mt-5 text-sm text-muted-foreground">Crie ou selecione uma avaliação para lançar as notas.</p>}
        </div>
      </div>

      <div id="atividade-form" className="sina-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3"><ClipboardList className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Atividades</p><h3 className="font-semibold">{taskEditingId ? "Editar atividade" : "Publicar atividade"}</h3></div></div>
            <p className="mt-2 text-sm text-muted-foreground">Crie atividades para a turma, defina prazo e anexe um arquivo.</p>
          </div>
          {taskEditingId && <Button variant="outline" onClick={resetTaskForm}>Cancelar edição</Button>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Input placeholder="Título da atividade" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
          <select value={taskSubjectId} onChange={e => setTaskSubjectId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a disciplina</option>{classSubjects.map(s => <option key={s.id} value={s.subject_id}>{s.subject_name}</option>)}</select>
          <Input type="datetime-local" value={taskDueAt} onChange={e => setTaskDueAt(e.target.value)} aria-label="Prazo da atividade" />
          {!taskEditingId && <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm"><Paperclip className="size-4 text-muted-foreground" /><span className="truncate">{taskFile?.name ?? "Anexar arquivo (até 20 MB)"}</span><input type="file" className="sr-only" onChange={e => setTaskFile(e.target.files?.[0] ?? null)} /></label>}
          <textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Instruções da atividade" className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
          <Button className="md:col-span-2" onClick={() => void saveTask()} disabled={taskSaving || !taskTitle.trim() || !taskSubjectId}>{taskSaving ? "Salvando..." : taskEditingId ? "Salvar alterações" : "Publicar atividade"}</Button>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between"><h4 className="font-semibold">Atividades publicadas</h4><span className="text-xs text-muted-foreground">{tasks.data?.length ?? 0} cadastrada{tasks.data?.length === 1 ? "" : "s"}</span></div>
          {(tasks.data ?? []).map((task: TeacherTask) => (
            <article key={task.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><p className="font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.subject} · {task.classroom} · {task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"}</p>{task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}{task.attachment_name && <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-primary"><Paperclip className="size-3.5" />{task.attachment_name}</p>}</div>
                <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => startEditTask(task)}><Pencil className="mr-1.5 size-3.5" />Editar</Button><Button variant="outline" size="sm" onClick={() => void removeTask(task.id)}><Trash2 className="mr-1.5 size-3.5" />Excluir</Button></div>
              </div>
            </article>
          ))}
          {!tasks.data?.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma atividade publicada nesta instituição.</p>}
        </div>
      </div>

      <div className="sina-card p-6">
        <div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Entregas</p><h3 className="font-semibold">Corrigir atividades enviadas</h3></div></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={taskId} onChange={e => setTaskId(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione uma atividade</option>{(tasks.data ?? []).map((t: TeacherTask) => <option key={t.id} value={t.id}>{t.subject} · {t.title} · {t.classroom}</option>)}</select></div>
        <div className="mt-4 space-y-3">{(submissions.data ?? []).length ? (submissions.data ?? []).map(item => { const value=grading[item.id] ?? {score:item.score == null ? "" : String(item.score), feedback:item.feedback ?? ""}; return <article key={item.id} className="rounded-2xl border border-border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold">{item.student_name}</p><p className="text-xs text-muted-foreground">{item.enrollment} · {new Date(item.submitted_at).toLocaleString("pt-BR")}</p><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content || "Sem texto. Verifique o anexo da entrega."}</p></div><div className="grid min-w-[280px] gap-2 sm:grid-cols-[120px_1fr]"><Input type="number" min="0" max="10" step="0.01" placeholder="Nota" value={value.score} onChange={e => setGrading(v => ({ ...v, [item.id]: { ...value, score: e.target.value } }))} /><Input placeholder="Feedback" value={value.feedback} onChange={e => setGrading(v => ({ ...v, [item.id]: { ...value, feedback: e.target.value } }))} /><Button className="sm:col-span-2" onClick={() => void gradeSubmission(item.id)}><Save className="mr-2 size-4" />Salvar correção</Button></div></div></article> }) : taskId ? <p className="text-sm text-muted-foreground">Nenhuma entrega registrada para esta atividade.</p> : <p className="text-sm text-muted-foreground">Selecione uma atividade para ver as entregas.</p>}</div>
      </div>

      <div className="sina-card overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/40 p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-3"><FileText className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Biblioteca acadêmica</p><h3 className="mt-1 font-semibold">Materiais de estudo</h3></div></div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Publique arquivos organizados por turma, disciplina e período para seus alunos.</p></div>
            <div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} placeholder="Buscar material..." aria-label="Buscar material" /></div>
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="rounded-2xl border border-border bg-secondary/30 p-5"><p className="text-sm font-semibold">Publicar material</p><p className="mt-1 text-xs text-muted-foreground">PDF, imagens, Word, PowerPoint, Excel ou TXT · até 20 MB.</p><div className="mt-4 space-y-3">
            <Input value={materialTitle} onChange={e => setMaterialTitle(e.target.value)} placeholder="Título do material" aria-label="Título do material" />
            <select value={materialSubjectId} onChange={e => setMaterialSubjectId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todas as disciplinas</option>{classSubjects.map(subject => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>)}</select>
            <select value={materialTermId} onChange={e => setMaterialTermId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem período específico</option>{(options.data?.terms ?? []).map(term => <option key={term.id} value={term.id}>{term.name}</option>)}</select>
            <textarea value={materialDescription} onChange={e => setMaterialDescription(e.target.value)} placeholder="Descrição (opcional)" className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"><input type="file" className="sr-only" onChange={e => setMaterialFile(e.target.files?.[0] ?? null)} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" /><div className="flex items-center gap-3"><Paperclip className="size-4 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-medium">{materialFile?.name ?? "Selecionar arquivo"}</p><p className="text-xs text-muted-foreground">{materialFile ? (materialFile.size / 1024 / 1024).toFixed(2) + " MB" : "Clique para escolher o arquivo"}</p></div></div></label>
            <Button className="w-full" onClick={() => void publishMaterial()} disabled={materialSaving || !materialTitle.trim() || !materialFile}>{materialSaving ? "Publicando…" : "Publicar material"}</Button>
          </div></div>
          <div className="min-w-0">{materials.isPending ? <div className="rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">Carregando biblioteca…</div> : materials.isError ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center"><p className="text-sm font-medium">Não foi possível carregar os materiais.</p></div> : visibleMaterials.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><FileText className="mx-auto size-8 text-muted-foreground/60" /><p className="mt-3 text-sm font-medium">{materialSearch ? "Nenhum material encontrado" : "Nenhum material publicado nesta turma"}</p><p className="mt-1 text-xs text-muted-foreground">{materialSearch ? "Tente outro termo de busca." : "Publique o primeiro arquivo usando o formulário ao lado."}</p></div> : <div className="grid gap-3 md:grid-cols-2">{visibleMaterials.map(material => <article key={material.id} className="group rounded-2xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate font-semibold">{material.title}</h4><p className="mt-1 truncate text-xs text-muted-foreground">{material.subject_name ?? "Todas as disciplinas"}{material.term_name ? " · " + material.term_name : ""}</p></div><button type="button" onClick={() => void archiveMaterial(material)} className="rounded-md p-2 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive" aria-label={"Arquivar " + material.title}><Archive className="size-4" /></button></div>{material.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{material.description}</p>}<div className="mt-3 flex items-center justify-between gap-3"><span className="truncate text-xs text-muted-foreground">{material.file_name} · {(material.file_size / 1024 / 1024).toFixed(2)} MB</span>{material.file_url && <a href={material.file_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">Abrir <ExternalLink className="size-3" /></a>}</div></div></div></article>)}</div>}</div>
        </div>
      </div>
      <div className="sina-card p-6">
        <div className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" /><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Calendário</p><h3 className="font-semibold">Agenda acadêmica</h3></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"><Input placeholder="Título do evento" value={eventTitle} onChange={e => setEventTitle(e.target.value)} /><Input type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} /><select value={eventClassroom} onChange={e => setEventClassroom(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Todas as turmas</option>{classrooms.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button onClick={() => void createEvent()} disabled={!eventTitle.trim() || !eventStart}>Adicionar</Button></div>
        <div className="mt-3 flex gap-2"><select value={eventType} onChange={e => setEventType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="aula">Aula</option><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="evento">Evento</option><option value="recesso">Recesso</option><option value="outro">Outro</option></select><Input placeholder="Descrição (opcional)" value={eventDescription} onChange={e => setEventDescription(e.target.value)} /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{upcoming.map(event => <div key={event.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{event.title}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{event.event_type}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.classroom_name ?? "Institucional"} · {new Date(event.start_at).toLocaleString("pt-BR")}</p>{event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}</div>)}{!upcoming.length && <p className="text-sm text-muted-foreground">Nenhum evento neste mês.</p>}</div>
      </div>
    </section>
  );
}
