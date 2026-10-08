import { useState } from "react";
import { AlertTriangle, BookOpen, CalendarRange, Clock, Layers3, Save, Archive, RotateCcw, Users, FileUp, Mail, Copy, X, Pencil, Trash2, SlidersHorizontal, Eye, History, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminArchiveClassroom,
  adminRestoreClassroom,
  adminDeleteClassroom,
  adminUpsertClassroom,
  deleteAdminSubject,
  adminUpsertSubject,
  adminUpsertTerm,
  loadAdminAcademicPeriodLocks,
  loadAdminGradeChangeAudit,
  setAdminAcademicPeriodLock,
  errorText,
  loadAdminAcademicSetup,
  loadAdminInstitutionTeachers,
  loadAdminTeacherAssignments,
  loadAdminSubjectTeacherMatrix,
  adminSetSubjectResponsible,
  adminSetSubjectTeacherLink,
  adminRemoveSubjectTeacherLink,
  adminAssignTeacherToClassroom,
  adminUnassignTeacherFromClassroom,
  adminImportAcademicCsv,
  loadAdminClassroomHub,
  createAdminInstitutionInvitation, loadAdminInstitutionInvitations, revokeAdminInstitutionInvitation,
} from "@/lib/sina-data";



import { loadAdminClassroomTimetable, adminUpsertClassroomTimetable, adminDeleteClassroomTimetable } from "@/lib/timetable-data";

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if ((ch === "," || ch === ";") && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += ch;
    }
  }
  values.push(value.trim());
  return values;
}

function parseAcademicCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");
  const headers = parseCsvLine(lines[0]!).map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  });
  return rows;
}

export function AdminAcademicSetup() {
  const qc = useQueryClient();
  const setup = useQuery({ queryKey: ["admin-academic-setup"], queryFn: loadAdminAcademicSetup });
  const teachers = useQuery({ queryKey: ["admin-institution-teachers"], queryFn: loadAdminInstitutionTeachers });
  const assignments = useQuery({ queryKey: ["admin-teacher-classroom-assignments"], queryFn: loadAdminTeacherAssignments });
  const subjectTeacherMatrix = useQuery({ queryKey: ["admin-subject-teacher-matrix"], queryFn: loadAdminSubjectTeacherMatrix, staleTime: 10000 });
  const invitations = useQuery({ queryKey: ["admin-institution-invitations"], queryFn: loadAdminInstitutionInvitations });
  const periodLocks = useQuery({ queryKey: ["admin-academic-period-locks"], queryFn: loadAdminAcademicPeriodLocks, staleTime: 10000 });
  const gradeAudit = useQuery({ queryKey: ["admin-grade-change-audit"], queryFn: () => loadAdminGradeChangeAudit(50), staleTime: 10000, refetchOnWindowFocus: true });
  const [timetableClassroomId, setTimetableClassroomId] = useState("");
  const [timetableEntry, setTimetableEntry] = useState<{ id: string | null; classroomSubjectId: string; weekday: number; startTime: string; endTime: string; room: string; notes: string }>({
    id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "",
  });
  const classroomTimetable = useQuery({
    queryKey: ["admin-classroom-timetable", timetableClassroomId],
    queryFn: () => loadAdminClassroomTimetable(timetableClassroomId),
    enabled: !!timetableClassroomId,
  });
  const [classroomHubId, setClassroomHubId] = useState<string | null>(null);
  const classroomHub = useQuery({
    queryKey: ["admin-classroom-hub", classroomHubId],
    queryFn: () => loadAdminClassroomHub(classroomHubId!),
    enabled: !!classroomHubId,
    staleTime: 10000,
  });
  const [classroomName, setClassroomName] = useState("");
  const [classroomCode, setClassroomCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termCurrent, setTermCurrent] = useState(true);
  const [periodBusy, setPeriodBusy] = useState<number | null>(null);
  const [periodAction, setPeriodAction] = useState<{ period: number; closed: boolean } | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [teacherClassroomId, setTeacherClassroomId] = useState("");
  const [importing, setImporting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"teacher" | "student">("teacher");
  const [inviteClassroom, setInviteClassroom] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteClassroom, setConfirmDeleteClassroom] = useState<{ id: string; name: string } | null>(null);
  const [editingClassroom, setEditingClassroom] = useState<{ id: string; name: string; code: string } | null>(null);
  const [matrixClassroomFilter, setMatrixClassroomFilter] = useState("all");
  const [matrixSubjectFilter, setMatrixSubjectFilter] = useState("all");
  const [matrixTeacherFilter, setMatrixTeacherFilter] = useState("all");
  const [linkClassroomId, setLinkClassroomId] = useState("");
  const [linkSubjectId, setLinkSubjectId] = useState("");
  const [linkTeacherId, setLinkTeacherId] = useState("");
  const [confirmRemoveSubjectTeacher, setConfirmRemoveSubjectTeacher] = useState<{ classroomId: string; subjectId: string; teacherId: string; teacherName: string; subjectName: string } | null>(null);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-academic-setup"] }),
      qc.invalidateQueries({ queryKey: ["admin-teacher-classroom-assignments"] }),
      qc.invalidateQueries({ queryKey: ["admin-subject-teacher-matrix"] }),
      qc.invalidateQueries({ queryKey: ["admin-institution-teachers"] }),
      qc.invalidateQueries({ queryKey: ["admin-institution-invitations"] }),
    ]);
  }
  async function assignTeacher() {
    if (!teacherId || !teacherClassroomId) return;
    setBusyAction("assign-teacher");
    try { await adminAssignTeacherToClassroom(teacherId, teacherClassroomId); setTeacherId(""); setTeacherClassroomId(""); await refresh(); toast.success("Professor vinculado à turma."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }
  async function setSubjectResponsible(classroomId: string, subjectId: string, teacherId: string | null) {
    setBusyAction("responsible:" + classroomId + ":" + subjectId);
    try {
      await adminSetSubjectResponsible(classroomId, subjectId, teacherId);
      await qc.invalidateQueries({ queryKey: ["admin-subject-teacher-matrix"] });
      await qc.invalidateQueries({ queryKey: ["admin-academic-setup"] });
      toast.success(teacherId ? "Professor responsável atualizado." : "Responsável removido.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function addSubjectTeacher(classroomId: string, subjectId: string, teacherId: string) {
    if (!teacherId) return;
    setBusyAction("add-subject-teacher:" + classroomId + ":" + subjectId + ":" + teacherId);
    try {
      await adminSetSubjectTeacherLink(classroomId, subjectId, teacherId, false);
      await qc.invalidateQueries({ queryKey: ["admin-subject-teacher-matrix"] });
      await qc.invalidateQueries({ queryKey: ["admin-academic-setup"] });
      toast.success("Professor vinculado à disciplina.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function removeSubjectTeacher() {
    if (!confirmRemoveSubjectTeacher) return;
    const item = confirmRemoveSubjectTeacher;
    setBusyAction("remove-subject-teacher:" + item.classroomId + ":" + item.subjectId + ":" + item.teacherId);
    try {
      await adminRemoveSubjectTeacherLink(item.classroomId, item.subjectId, item.teacherId);
      await qc.invalidateQueries({ queryKey: ["admin-subject-teacher-matrix"] });
      await qc.invalidateQueries({ queryKey: ["admin-academic-setup"] });
      setConfirmRemoveSubjectTeacher(null);
      toast.success("Professor desvinculado da disciplina.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function unassignTeacher(teacher: string, classroom: string) {
    setBusyAction("unassign:"+teacher+":"+classroom);
    try { await adminUnassignTeacherFromClassroom(teacher, classroom); await refresh(); toast.success("Professor desvinculado da turma."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  async function saveClassroom() {
    if (!classroomName.trim()) { toast.error("Informe o nome da turma."); return; }
    setBusyAction("classroom");
    try { await adminUpsertClassroom(null, classroomName.trim(), classroomCode.trim()); setClassroomName(""); setClassroomCode(""); await refresh(); toast.success("Turma criada."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }
  async function archiveClassroom(id: string) {
    setBusyAction("archive:"+id);
    try { await adminArchiveClassroom(id); await refresh(); toast.success("Turma arquivada."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  async function restoreClassroom(id: string) {
    setBusyAction("restore:"+id);
    try { await adminRestoreClassroom(id); await refresh(); toast.success("Turma reativada."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  async function saveClassroomEdit() {
    if (!editingClassroom) return;
    if (!editingClassroom.name.trim()) { toast.error("Informe o nome da turma."); return; }
    setBusyAction("edit-classroom:"+editingClassroom.id);
    try {
      await adminUpsertClassroom(editingClassroom.id, editingClassroom.name.trim(), editingClassroom.code.trim());
      await refresh();
      setEditingClassroom(null);
      toast.success("Turma atualizada.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteClassroom() {
    if (!confirmDeleteClassroom) return;
    setBusyAction("delete-classroom:"+confirmDeleteClassroom.id);
    try {
      await adminDeleteClassroom(confirmDeleteClassroom.id);
      await refresh();
      setConfirmDeleteClassroom(null);
      toast.success("Turma excluída definitivamente.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }
  async function saveSubject() {
    if (!subjectName.trim()) { toast.error("Informe o nome da disciplina."); return; }
    setBusyAction("subject");
    try { await adminUpsertSubject(null, subjectName.trim(), subjectCode.trim()); setSubjectName(""); setSubjectCode(""); await refresh(); toast.success("Disciplina criada."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  async function deleteSubject() {
    if (!confirmDeleteSubject) return;
    setBusyAction("delete-subject:" + confirmDeleteSubject.id);
    try {
      await deleteAdminSubject(confirmDeleteSubject.id);
      await refresh();
      toast.success("Disciplina excluída.");
      setConfirmDeleteSubject(null);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyAction(null);
    }
  }
  async function saveTerm() {
    if (!termName.trim()) { toast.error("Informe o nome do período."); return; }
    if (termStart && termEnd && termStart > termEnd) { toast.error("A data de início não pode ser posterior à data final."); return; }
    setBusyAction("term");
    try { await adminUpsertTerm(null, termName.trim(), termStart || null, termEnd || null, termCurrent); setTermName(""); setTermStart(""); setTermEnd(""); await refresh(); toast.success("Período acadêmico salvo."); }
    catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  const timetableClassroomRows = (setup.data?.matrix ?? []).filter(row => row.classroom_id === timetableClassroomId && row.teacher_id);
  const timetableDays = [
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
  ];
  async function saveTimetableEntry() {
    if (busyAction !== null) return;
    if (!timetableClassroomId || !timetableEntry.classroomSubjectId) { toast.error("Selecione a turma e a disciplina."); return; }
    if (!timetableEntry.startTime || !timetableEntry.endTime || timetableEntry.endTime <= timetableEntry.startTime) { toast.error("Informe um horário válido."); return; }
    setBusyAction("timetable");
    try {
      await adminUpsertClassroomTimetable({
        id: timetableEntry.id,
        classroomId: timetableClassroomId,
        classroomSubjectId: timetableEntry.classroomSubjectId,
        weekday: timetableEntry.weekday,
        startTime: timetableEntry.startTime,
        endTime: timetableEntry.endTime,
        room: timetableEntry.room,
        notes: timetableEntry.notes,
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-classroom-timetable", timetableClassroomId] }), qc.invalidateQueries({ queryKey: ["dashboard-timetable"] })]);
      setTimetableEntry({ id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "" });
      toast.success(timetableEntry.id ? "Aula atualizada no cronograma." : "Aula adicionada ao cronograma.");
    } catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }
  async function removeTimetableEntry(id: string) {
    if (busyAction !== null) return;
    setBusyAction("timetable-delete:" + id);
    try {
      await adminDeleteClassroomTimetable(id);
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin-classroom-timetable", timetableClassroomId] }), qc.invalidateQueries({ queryKey: ["dashboard-timetable"] })]);
      if (timetableEntry.id === id) setTimetableEntry({ id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "" });
      toast.success("Aula removida do cronograma.");
    } catch (error) { toast.error(errorText(error)); }
    finally { setBusyAction(null); }
  }

  const matrixRows = (setup.data?.matrix ?? []).filter((row) => (
    (matrixClassroomFilter === "all" || row.classroom_id === matrixClassroomFilter) &&
    (matrixSubjectFilter === "all" || row.subject_id === matrixSubjectFilter) &&
    (matrixTeacherFilter === "all" || row.teacher_id === matrixTeacherFilter)
  ));

  const quality = setup.data?.quality;
  const qualityIssueCount =
    (quality?.students_without_class ?? 0) +
    (quality?.classrooms_without_teacher?.length ?? 0) +
    (quality?.classrooms_without_subject?.length ?? 0) +
    (quality?.subject_links_without_teacher?.length ?? 0) +
    (quality?.tasks_without_subject ?? 0) +
    (quality?.attendance_without_subject ?? 0);

  return (
    <section id="academico-setup" className="sina-card sina-card-hover p-6 scroll-mt-28">
      <div className="flex items-start gap-3"><Layers3 className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Estrutura acadêmica</h2><p className="mt-1 text-sm text-muted-foreground">Cadastre turmas, disciplinas e períodos. Esses dados alimentam diário, avaliações, calendário e relatórios.</p></div></div>
      {setup.isPending ? <p className="mt-5 text-sm text-muted-foreground">Carregando estrutura…</p> : setup.error ? <p className="mt-5 text-sm text-destructive">{errorText(setup.error)}</p> : (
        <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <FileUp className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">Importar alunos e turmas por CSV</p>
              <p className="mt-1 text-sm text-muted-foreground">Use as colunas <b>tipo,nome,codigo,matricula,turma</b>. Para turma, informe tipo=turma e nome/código. Para aluno, use tipo=aluno, nome, matrícula e, opcionalmente, turma.</p>
              <p className="mt-1 text-xs text-muted-foreground">Exemplo: <code>aluno,João Silva,,2026001,8º Ano A</code></p>
            </div>
          </div>
          <div className="mt-4">
            <Input type="file" accept=".csv,text/csv" disabled={importing} onChange={async e => {
              const file = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              setImporting(true);
              try {
                const text = await file.text();
                const rows = parseAcademicCsv(text);
                const result = await adminImportAcademicCsv(rows);
                await refresh();
                toast.success(`Importação concluída: ${result.classes} turma(s), ${result.students} aluno(s), ${result.skipped} linha(s) ignorada(s).`);
              } catch (error) {
                toast.error(errorText(error));
              } finally {
                setImporting(false);
              }
            }} />
            {importing && <p className="mt-2 text-xs text-muted-foreground">Importando dados…</p>}
          </div>
        </div>


          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2"><Layers3 className="size-4 text-primary" /><p className="font-semibold">Turmas</p></div>
              <div className="mt-4 space-y-2"><Input placeholder="Nome da turma" value={classroomName} onChange={e => setClassroomName(e.target.value)} /><Input placeholder="Código (opcional)" value={classroomCode} onChange={e => setClassroomCode(e.target.value)} /><Button onClick={() => void saveClassroom()} disabled={busyAction !== null || !classroomName.trim()}><Save className="mr-2 size-4" />{busyAction === "classroom" ? "Salvando…" : "Criar turma"}</Button></div>
              <div className="mt-4 space-y-2">
                {setup.data?.classrooms.map(c => (
                  <div key={c.id} className="rounded-xl bg-secondary/50 p-3 text-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{c.name}</p><span className={c.status === "active" ? "rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary" : "rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"}>{c.status === "active" ? "Ativa" : "Arquivada"}</span></div>
                        <p className="mt-1 text-xs text-muted-foreground">{c.code || "Sem código"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded-full border border-border bg-background px-2 py-1">{c.student_count} aluno{c.student_count === 1 ? "" : "s"}</span>
                          <span className="rounded-full border border-border bg-background px-2 py-1">{c.teacher_count} professor{c.teacher_count === 1 ? "" : "es"}</span>
                          <span className="rounded-full border border-border bg-background px-2 py-1">{c.subject_count} disciplina{c.subject_count === 1 ? "" : "s"}</span>
                          {c.task_count > 0 && <span className="rounded-full border border-border bg-background px-2 py-1">{c.task_count} atividade{c.task_count === 1 ? "" : "s"}</span>}
                          {c.assessment_count > 0 && <span className="rounded-full border border-border bg-background px-2 py-1">{c.assessment_count} avaliação{c.assessment_count === 1 ? "" : "ões"}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button size="sm" variant="ghost" title={`Cronograma de ${c.name}`} aria-label={`Cronograma de ${c.name}`} disabled={busyAction !== null} onClick={() => { setTimetableClassroomId(c.id); setTimetableEntry({ id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "" }); document.getElementById("cronograma-admin")?.scrollIntoView({ behavior: "smooth" }); }}><Clock className="size-4" /></Button>
                         <Button size="sm" variant="ghost" disabled={busyAction !== null} onClick={() => setClassroomHubId(c.id)} aria-label={`Abrir central de ${c.name}`}><Eye className="size-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busyAction !== null} onClick={() => setEditingClassroom({ id: c.id, name: c.name, code: c.code || "" })} aria-label={`Editar ${c.name}`}><Pencil className="size-4" /></Button>
                        {c.status === "active" ? (
                          <Button size="sm" variant="ghost" disabled={busyAction !== null} onClick={() => void archiveClassroom(c.id)} aria-label={`Arquivar ${c.name}`}>{busyAction === "archive:"+c.id ? "…" : <Archive className="size-4" />}</Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" disabled={busyAction !== null} onClick={() => void restoreClassroom(c.id)} aria-label={`Reativar ${c.name}`}>{busyAction === "restore:"+c.id ? "…" : <RotateCcw className="size-4" />}</Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => setConfirmDeleteClassroom({ id: c.id, name: c.name })} aria-label={`Excluir ${c.name}`}><Trash2 className="size-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><BookOpen className="size-4 text-primary" /><p className="font-semibold">Disciplinas</p></div><div className="mt-4 space-y-2"><Input placeholder="Nome da disciplina" value={subjectName} onChange={e => setSubjectName(e.target.value)} /><Input placeholder="Código (opcional)" value={subjectCode} onChange={e => setSubjectCode(e.target.value)} /><Button onClick={() => void saveSubject()} disabled={busyAction !== null || !subjectName.trim()}><Save className="mr-2 size-4" />{busyAction === "subject" ? "Salvando…" : "Criar disciplina"}</Button></div><div className="mt-4 space-y-2">{setup.data?.subjects.map(s => <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3 text-sm"><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.code || "Sem código"} · {s.status === "active" ? "Ativa" : "Inativa"}</p></div><Button size="sm" variant="ghost" className="text-destructive" disabled={busyAction !== null} onClick={() => setConfirmDeleteSubject({ id: s.id, name: s.name })}>{busyAction === "delete-subject:"+s.id ? "Excluindo…" : "Excluir"}</Button></div>)}</div></div>

            <div className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><CalendarRange className="size-4 text-primary" /><p className="font-semibold">Períodos</p></div><div className="mt-4 space-y-2"><Input placeholder="Ex.: 1º Bimestre" value={termName} onChange={e => setTermName(e.target.value)} /><div className="grid grid-cols-2 gap-2"><Input type="date" value={termStart} onChange={e => setTermStart(e.target.value)} /><Input type="date" value={termEnd} onChange={e => setTermEnd(e.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={termCurrent} onChange={e => setTermCurrent(e.target.checked)} /> Marcar como período atual</label><Button onClick={() => void saveTerm()} disabled={busyAction !== null || !termName.trim()}><Save className="mr-2 size-4" />{busyAction === "term" ? "Salvando…" : "Criar período"}</Button></div><div className="mt-4 space-y-2">{setup.data?.terms.map(t => <div key={t.id} className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-medium">{t.name}</p>{t.is_current && <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Atual</span>}</div><p className="text-xs text-muted-foreground">{t.starts_at || "Sem início"} · {t.ends_at || "Sem fim"}</p></div>)}</div></div>
          </div>

          <section className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Controle acadêmico</p>
                  <h3 className="mt-1 text-lg font-semibold">Fechamento de períodos</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Encerre o lançamento oficial de notas de um período quando a conferência estiver concluída. O histórico continua disponível para consulta e somente um administrador pode reabrir.</p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold">{(periodLocks.data ?? []).filter(item => item.is_closed).length}/4 fechados</span>
            </div>
            {periodLocks.isPending ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(item => <div key={item} className="sina-skeleton h-32 rounded-2xl" />)}</div> :
              periodLocks.error ? <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Não foi possível carregar o status dos períodos.</p><p className="mt-1 text-muted-foreground">{errorText(periodLocks.error)}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void periodLocks.refetch()}>Tentar novamente</Button></div> :
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(periodLocks.data ?? []).map(item => <article key={item.period} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.period}º período</p><p className="mt-1 font-semibold">{setup.data?.terms.find(t => t.name.toLowerCase().includes(String(item.period)))?.name ?? `Período ${item.period}`}</p></div>
                    {item.is_closed ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive"><LockKeyhole className="size-3" /> Encerrado</span> : <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"><UnlockKeyhole className="size-3" /> Aberto</span>}
                  </div>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground">{item.is_closed ? "Este período está bloqueado para alterações oficiais no diário." : "Professores autorizados podem lançar e corrigir notas."}</p>
                  <Button className="mt-3 w-full" size="sm" variant={item.is_closed ? "outline" : "default"} disabled={periodBusy !== null} onClick={() => setPeriodAction({ period: item.period, closed: !item.is_closed })}>
                    {item.is_closed ? "Reabrir período" : "Encerrar período"}
                  </Button>
                </article>)}
              </div>}
          </section>
          <section className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <History className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Rastreabilidade</p>
                  <h3 className="mt-1 text-lg font-semibold">Histórico de alterações de notas</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Registra inclusões, alterações e exclusões de notas oficiais por instituição, mantendo o contexto necessário para conferência administrativa.</p>
                </div>
              </div>
            </div>
            {gradeAudit.isPending ? <div className="mt-5 sina-skeleton h-44 rounded-2xl" /> :
              gradeAudit.error ? <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Não foi possível carregar o histórico.</p><p className="mt-1 text-muted-foreground">{errorText(gradeAudit.error)}</p></div> :
              !(gradeAudit.data ?? []).length ? <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma alteração de nota registrada ainda.</div> :
              <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-secondary/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Aluno</th>
                      <th className="px-4 py-3 font-semibold">Disciplina</th>
                      <th className="px-4 py-3 font-semibold">Período</th>
                      <th className="px-4 py-3 font-semibold">Alteração</th>
                      <th className="px-4 py-3 font-semibold">Antes → depois</th>
                      <th className="px-4 py-3 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(gradeAudit.data ?? []).map(item => {
                      const actionLabel = item.action === "insert" ? "Lançamento" : item.action === "delete" ? "Exclusão" : "Alteração";
                      return <tr key={item.id}>
                        <td className="px-4 py-3"><p className="font-medium">{item.student_name || "Aluno não identificado"}</p><p className="text-[11px] text-muted-foreground">{item.student_id.slice(0, 8)}…</p></td>
                        <td className="px-4 py-3">{item.subject || "Sem disciplina"}</td>
                        <td className="px-4 py-3">{item.period}º</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{actionLabel}</span></td>
                        <td className="px-4 py-3 tabular-nums">{item.old_score == null ? "—" : Number(item.old_score).toFixed(1)} → {item.new_score == null ? "—" : Number(item.new_score).toFixed(1)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(item.changed_at).toLocaleString("pt-BR")}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>}
          </section>

          <section className="rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <SlidersHorizontal className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Matriz acadêmica</p>
                  <h3 className="mt-1 text-lg font-semibold">Turma → disciplina → professor</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Veja exatamente quem ministra cada disciplina em cada turma e acompanhe rapidamente alunos, atividades, avaliações e frequência.</p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold">{matrixRows.length} vínculo{matrixRows.length === 1 ? "" : "s"}</span>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-3">
              <select value={matrixClassroomFilter} onChange={e => setMatrixClassroomFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">Todas as turmas</option>
                {(setup.data?.classrooms ?? []).map(c => <option key={c.id} value={c.id}>{c.name}{c.status === "archived" ? " · Arquivada" : ""}</option>)}
              </select>
              <select value={matrixSubjectFilter} onChange={e => setMatrixSubjectFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">Todas as disciplinas</option>
                {(setup.data?.subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={matrixTeacherFilter} onChange={e => setMatrixTeacherFilter(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">Todos os professores</option>
                {Array.from(new Map((setup.data?.matrix ?? []).filter(row => row.teacher_id).map(row => [row.teacher_id, row.teacher_name])).entries()).map(([id, name]) => <option key={id ?? "none"} value={id ?? ""}>{name}</option>)}
              </select>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="font-semibold">Professor responsável por disciplina</p>
                  <p className="mt-1 text-sm text-muted-foreground">O primeiro professor é o responsável pelas notas oficiais. Professores adicionais continuam vinculados e podem atuar conforme suas permissões.</p>
                </div>
              </div>
              {(() => {
                const selectedLinks = (subjectTeacherMatrix.data ?? []).filter(row =>
                  row.classroom_id === linkClassroomId && row.subject_id === linkSubjectId
                );
                const selectedTeacherIds = new Set(selectedLinks.map(row => row.teacher_id).filter(Boolean));
                const availableLinkTeachers = (assignments.data ?? []).filter(a =>
                  a.classroom_id === linkClassroomId && !selectedTeacherIds.has(a.teacher_id)
                );
                const firstLink = selectedLinks.length === 0;
                return (
              <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <p className="font-semibold">Criar novo vínculo</p>
                <p className="mt-1 text-xs text-muted-foreground">Use quando uma disciplina ainda não possui professor nesta turma. O primeiro vínculo será definido automaticamente como responsável pelas notas oficiais.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <select value={linkClassroomId} onChange={e => { setLinkClassroomId(e.target.value); setLinkTeacherId(""); }} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="">Selecione a turma</option>
                    {(setup.data?.classrooms ?? []).filter(c => c.status === "active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={linkSubjectId} onChange={e => setLinkSubjectId(e.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="">Selecione a disciplina</option>
                    {(setup.data?.subjects ?? []).filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={linkTeacherId} onChange={e => setLinkTeacherId(e.target.value)} disabled={!linkClassroomId} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="">Selecione o professor</option>
                    {availableLinkTeachers.map(a => <option key={a.teacher_id} value={a.teacher_id}>{a.teacher_name || a.teacher_email}</option>)}
                  </select>
                </div>
                <Button
                  className="mt-3"
                  disabled={busyAction !== null || !linkClassroomId || !linkSubjectId || !linkTeacherId}
                  onClick={async () => {
                    setBusyAction("create-subject-link");
                    try {
                      await adminSetSubjectTeacherLink(linkClassroomId, linkSubjectId, linkTeacherId, firstLink);
                      await qc.invalidateQueries({ queryKey: ["admin-subject-teacher-matrix"] });
                      await qc.invalidateQueries({ queryKey: ["admin-academic-setup"] });
                      setLinkTeacherId("");
                      toast.success("Vínculo professor/disciplina criado.");
                    } catch (error) {
                      toast.error(errorText(error));
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "create-subject-link" ? "Criando…" : "Criar vínculo"}
                </Button>
              </div>
                );
              })()}
              {subjectTeacherMatrix.isPending ? (
                <p className="mt-4 text-sm text-muted-foreground">Carregando responsáveis…</p>
              ) : subjectTeacherMatrix.error ? (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-semibold">Não foi possível carregar os responsáveis.</p>
                  <p className="mt-1 text-muted-foreground">{errorText(subjectTeacherMatrix.error)}</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {Array.from(new Map((subjectTeacherMatrix.data ?? [])
                    .filter(row => matrixClassroomFilter === "all" || row.classroom_id === matrixClassroomFilter)
                    .filter(row => matrixSubjectFilter === "all" || row.subject_id === matrixSubjectFilter)
                    .reduce((groups, row) => {
                      const key = row.classroom_id + ":" + row.subject_id;
                      const current = groups.get(key) ?? [];
                      current.push(row);
                      groups.set(key, current);
                      return groups;
                    }, new Map<string, typeof subjectTeacherMatrix.data>())).values()).map((rows) => {
                    const items = (rows ?? []).filter(Boolean) as NonNullable<typeof subjectTeacherMatrix.data>;
                    if (!items.length) return null;
                    const first = items[0];
                    if (!first) return null;
                    if (matrixTeacherFilter !== "all" && !items.some(item => item.teacher_id === matrixTeacherFilter)) return null;
                    const responsible = items.find(item => item.is_primary);
                    const linkedTeacherIds = new Set(items.map(item => item.teacher_id).filter(Boolean));
                    const classTeachers = (assignments.data ?? []).filter(item => item.classroom_id === first.classroom_id);
                    const availableTeachers = classTeachers.filter(item => !linkedTeacherIds.has(item.teacher_id));
                    return (
                      <div key={first.classroom_id + ":" + first.subject_id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-medium">{first.classroom_name} · {first.subject_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{items.length} professor{items.length === 1 ? "" : "es"} vinculado{items.length === 1 ? "" : "s"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {responsible && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Responsável: {responsible.teacher_name}</span>}
                            {!responsible && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Sem responsável</span>}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {items.map(item => (
                            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium">{item.teacher_name}</p>
                                <p className="text-xs text-muted-foreground">{item.teacher_email || "Sem e-mail"} · {item.is_primary ? "Responsável pelas notas oficiais" : "Professor adicional"}</p>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                {!item.is_primary && (
                                  <Button size="sm" variant="outline" disabled={busyAction !== null} onClick={() => void setSubjectResponsible(first.classroom_id, first.subject_id, item.teacher_id)}>
                                    Tornar responsável
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busyAction !== null}
                                  onClick={() => { if (!item.teacher_id) return; setConfirmRemoveSubjectTeacher({
                                    classroomId: first.classroom_id, subjectId: first.subject_id, teacherId: item.teacher_id,
                                    teacherName: item.teacher_name, subjectName: first.subject_name,
                                  }); }}>
                                  Remover
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select defaultValue="" onChange={e => {
                            const teacherId = e.target.value;
                            e.currentTarget.value = "";
                            if (teacherId) void addSubjectTeacher(first.classroom_id, first.subject_id, teacherId);
                          }} disabled={busyAction !== null || availableTeachers.length === 0}
                            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm">
                            <option value="">Adicionar professor à disciplina…</option>
                            {availableTeachers.map(item => <option key={item.teacher_id} value={item.teacher_id}>{item.teacher_name}</option>)}
                          </select>
                          {availableTeachers.length === 0 && <span className="text-xs text-muted-foreground">Todos os professores vinculados à turma já estão nesta disciplina.</span>}
                        </div>
                      </div>
                    );
                  })}
                  {!subjectTeacherMatrix.data?.length && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum vínculo professor/disciplina encontrado.</div>}
                </div>
              )}
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-background">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-secondary/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Turma</th>
                    <th className="px-4 py-3 font-semibold">Disciplina</th>
                    <th className="px-4 py-3 font-semibold">Professor</th>
                    <th className="px-4 py-3 text-center font-semibold">Alunos</th>
                    <th className="px-4 py-3 text-center font-semibold">Atividades</th>
                    <th className="px-4 py-3 text-center font-semibold">Avaliações</th>
                    <th className="px-4 py-3 text-center font-semibold">Frequência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {matrixRows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.classroom_name}</p>
                        <p className="text-[11px] text-muted-foreground">{row.classroom_status === "active" ? "Ativa" : "Arquivada"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.subject_name}</p>
                        <p className="text-[11px] text-muted-foreground">{row.subject_code || "Sem código"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={row.teacher_id ? "font-medium" : "font-medium text-destructive"}>{row.teacher_id ? row.teacher_name : "Professor não vinculado"}</span>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{row.student_count}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{row.task_count}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{row.assessment_count}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{row.attendance_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!matrixRows.length && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum vínculo encontrado com esses filtros. Vincule disciplinas às turmas para começar a preencher a matriz.</div>}
            </div>
          </section>

          <section id="cronograma-admin" className="rounded-2xl border border-border p-5 sm:p-6 scroll-mt-28">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Cronograma de aulas</p>
                <h3 className="mt-1 text-lg font-semibold">Horários semanais de cada turma</h3>
                <p className="mt-1 text-sm text-muted-foreground">Cadastre o que cada turma tem em cada dia. O mesmo cronograma será mostrado para os alunos vinculados à turma.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <select aria-label="Turma do cronograma" value={timetableClassroomId} onChange={e => { setTimetableClassroomId(e.target.value); setTimetableEntry({ id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "" }); }} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Selecione a turma</option>
                {(setup.data?.classrooms ?? []).filter(c => c.status === "active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select aria-label="Disciplina e professor" value={timetableEntry.classroomSubjectId} onChange={e => setTimetableEntry(v => ({ ...v, classroomSubjectId: e.target.value }))} disabled={!timetableClassroomId || busyAction !== null} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Selecione disciplina + professor</option>
                {timetableClassroomRows.map(row => <option key={row.id} value={row.classroom_subject_id || row.id}>{row.subject_name} · {row.teacher_name}</option>)}
              </select>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select aria-label="Dia da semana" value={timetableEntry.weekday} onChange={e => setTimetableEntry(v => ({ ...v, weekday: Number(e.target.value) }))} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                {timetableDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
              <Input aria-label="Horário inicial" type="time" value={timetableEntry.startTime} onChange={e => setTimetableEntry(v => ({ ...v, startTime: e.target.value }))} />
              <Input aria-label="Horário final" type="time" value={timetableEntry.endTime} onChange={e => setTimetableEntry(v => ({ ...v, endTime: e.target.value }))} />
              <Input aria-label="Sala" placeholder="Sala (opcional)" value={timetableEntry.room} onChange={e => setTimetableEntry(v => ({ ...v, room: e.target.value }))} />
              <Input aria-label="Observações" placeholder="Observação (opcional)" value={timetableEntry.notes} onChange={e => setTimetableEntry(v => ({ ...v, notes: e.target.value }))} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void saveTimetableEntry()} disabled={busyAction !== null || !timetableClassroomId || !timetableEntry.classroomSubjectId}>
                <Save className="mr-2 size-4" />{busyAction === "timetable" ? "Salvando…" : timetableEntry.id ? "Salvar alterações" : "Adicionar aula"}
              </Button>
              {timetableEntry.id && <Button variant="outline" onClick={() => setTimetableEntry({ id: null, classroomSubjectId: "", weekday: 1, startTime: "13:10", endTime: "14:00", room: "", notes: "" })}>Cancelar edição</Button>}
            </div>

            {timetableClassroomId && classroomTimetable.isPending && <p className="mt-4 text-sm text-muted-foreground">Carregando cronograma…</p>}
            {timetableClassroomId && classroomTimetable.error && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Não foi possível carregar o cronograma.</p><p className="mt-1 text-muted-foreground">{errorText(classroomTimetable.error)}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void classroomTimetable.refetch()}>Tentar novamente</Button></div>}
            {timetableClassroomId && !classroomTimetable.isPending && !classroomTimetable.error && (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-secondary/50 text-left">
                    <tr><th className="px-3 py-3 font-semibold">Hora</th>{timetableDays.map(day => <th key={day.value} className="px-3 py-3 font-semibold">{day.label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Array.from(new Set((classroomTimetable.data ?? []).map(item => item.start_time))).sort().map(start => (
                      <tr key={start} className="align-top">
                        <td className="px-3 py-3 whitespace-nowrap font-semibold">{start.slice(0,5)}</td>
                        {timetableDays.map(day => {
                          const item = (classroomTimetable.data ?? []).find(row => row.weekday === day.value && row.start_time === start);
                          return <td key={day.value} className="min-w-[130px] px-3 py-2">
                            {item ? <div className="rounded-xl border border-primary/15 bg-primary/5 p-2">
                              <p className="font-semibold leading-tight">{item.subject_name}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{item.teacher_name || "Professor não informado"}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{item.start_time.slice(0,5)}–{item.end_time.slice(0,5)}{item.room ? " · " + item.room : ""}</p>
                              {item.notes && <p className="mt-1 text-[11px] text-muted-foreground">{item.notes}</p>}
                              <div className="mt-2 flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="Editar aula" title="Editar aula" disabled={busyAction !== null} onClick={() => setTimetableEntry({ id: item.id, classroomSubjectId: item.classroom_subject_id, weekday: item.weekday, startTime: item.start_time.slice(0,5), endTime: item.end_time.slice(0,5), room: item.room || "", notes: item.notes || "" })}><Pencil className="size-3.5" /></Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" aria-label="Excluir aula" title="Excluir aula" disabled={busyAction !== null} onClick={() => void removeTimetableEntry(item.id)}><Trash2 className="size-3.5" /></Button>
                              </div>
                            </div> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!(classroomTimetable.data ?? []).length && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma aula cadastrada para esta turma.</div>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Qualidade dos dados</p>
                  <h3 className="mt-1 text-lg font-semibold">Pendências acadêmicas detectadas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Corrigir estes pontos evita diários, notas e relatórios incompletos.</p>
                </div>
              </div>
              <span className={qualityIssueCount ? "rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300" : "rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"}>
                {qualityIssueCount ? qualityIssueCount + " ponto" + (qualityIssueCount === 1 ? "" : "s") : "Tudo certo"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Alunos sem turma</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.students_without_class ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Precisam de vínculo acadêmico.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Turmas sem professor</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.classrooms_without_teacher?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.classrooms_without_teacher ?? []).slice(0,2).map(item => item.name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Turmas sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.classrooms_without_subject?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.classrooms_without_subject ?? []).slice(0,2).map(item => item.name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Disciplinas sem professor</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.subject_links_without_teacher?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.subject_links_without_teacher ?? []).slice(0,2).map(item => item.classroom_name + " · " + item.subject_name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Atividades sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.tasks_without_subject ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Registros que precisam de classificação.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Frequência sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.attendance_without_subject ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Histórico antigo ou incompleto.</p>
              </div>
            </div>

            {!!quality?.attendance_without_subject && (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
                <p className="font-semibold">Há registros antigos de frequência sem disciplina.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">O SINA não atribui uma matéria automaticamente quando existem múltiplas disciplinas possíveis. Os novos lançamentos já usam o vínculo turma + disciplina + professor.</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Qualidade dos dados</p>
                  <h3 className="mt-1 text-lg font-semibold">Pendências acadêmicas detectadas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Corrigir estes pontos evita diários, notas e relatórios incompletos.</p>
                </div>
              </div>
              <span className={qualityIssueCount ? "rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300" : "rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"}>
                {qualityIssueCount ? qualityIssueCount + " ponto" + (qualityIssueCount === 1 ? "" : "s") : "Tudo certo"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Alunos sem turma</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.students_without_class ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Precisam de vínculo acadêmico.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Turmas sem professor</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.classrooms_without_teacher?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.classrooms_without_teacher ?? []).slice(0,2).map(item => item.name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Turmas sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.classrooms_without_subject?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.classrooms_without_subject ?? []).slice(0,2).map(item => item.name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Disciplinas sem professor</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.subject_links_without_teacher?.length ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(quality?.subject_links_without_teacher ?? []).slice(0,2).map(item => item.classroom_name + " · " + item.subject_name).join(" · ") || "Nenhuma"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Atividades sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.tasks_without_subject ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Registros que precisam de classificação.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase text-muted-foreground">Frequência sem disciplina</p>
                <p className="mt-1 text-2xl font-semibold">{quality?.attendance_without_subject ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Histórico antigo ou incompleto.</p>
              </div>
            </div>

            {!!quality?.attendance_without_subject && (
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
                <p className="font-semibold">Há registros antigos de frequência sem disciplina.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">O SINA não atribui uma matéria automaticamente quando existem múltiplas disciplinas possíveis. Os novos lançamentos já usam o vínculo turma + disciplina + professor.</p>
              </div>
            )}
          </section>

          <Dialog open={!!classroomHubId} onOpenChange={open => { if (!open) setClassroomHubId(null); }}>
            <DialogContent className="rounded-2xl border-border sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{classroomHub.data?.classroom.name || "Central da turma"}</DialogTitle>
                <DialogDescription>
                  Visão operacional da turma: pessoas, disciplinas, professores e volume de dados acadêmicos.
                </DialogDescription>
              </DialogHeader>

              {classroomHub.isPending && <div className="py-8 text-center text-sm text-muted-foreground">Carregando central da turma…</div>}
              {classroomHub.error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-semibold">Não foi possível carregar esta turma.</p>
                  <p className="mt-1 text-muted-foreground">{errorText(classroomHub.error)}</p>
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void classroomHub.refetch()}>Tentar novamente</Button>
                </div>
              )}
              {classroomHub.data && (
                <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ["Alunos", classroomHub.data.metrics.students],
                      ["Professores", classroomHub.data.metrics.teachers],
                      ["Disciplinas", classroomHub.data.metrics.subject_links],
                      ["Notas", classroomHub.data.metrics.grades],
                      ["Avaliações", classroomHub.data.metrics.assessments],
                      ["Atividades", classroomHub.data.metrics.tasks],
                      ["Materiais", classroomHub.data.metrics.materials],
                      ["Frequência", classroomHub.data.metrics.attendance],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{String(value)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">Professores</h3>
                        <span className="text-xs text-muted-foreground">{classroomHub.data.teachers.length}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {classroomHub.data.teachers.map(teacher => (
                          <div key={teacher.user_id} className="rounded-lg bg-secondary/50 p-3 text-sm">
                            <p className="font-medium">{teacher.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Professor vinculado à turma</p>
                          </div>
                        ))}
                        {!classroomHub.data.teachers.length && <p className="text-sm text-muted-foreground">Nenhum professor vinculado.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">Disciplinas e responsáveis</h3>
                        <span className="text-xs text-muted-foreground">{classroomHub.data.subjects.length}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {classroomHub.data.subjects.map(subject => (
                          <div key={subject.id + (subject.teacher_id ?? "")} className="rounded-lg bg-secondary/50 p-3 text-sm">
                            <p className="font-medium">{subject.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{subject.code || "Sem código"} · {subject.teacher_name}</p>
                          </div>
                        ))}
                        {!classroomHub.data.subjects.length && <p className="text-sm text-muted-foreground">Nenhuma disciplina vinculada.</p>}
                      </div>
                    </section>
                  </div>

                  <section className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">Alunos da turma</h3>
                      <span className="text-xs text-muted-foreground">{classroomHub.data.students.length}</span>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead className="bg-secondary/50 text-left">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Aluno</th>
                            <th className="px-3 py-2 font-semibold">Matrícula</th>
                            <th className="px-3 py-2 font-semibold">Vínculo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {classroomHub.data.students.map(student => (
                            <tr key={student.id}>
                              <td className="px-3 py-2 font-medium">{student.full_name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{student.enrollment || "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">Vinculado à turma</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!classroomHub.data.students.length && <p className="p-5 text-sm text-muted-foreground">Nenhum aluno vinculado a esta turma.</p>}
                    </div>
                  </section>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingClassroom} onOpenChange={open => { if (!open && busyAction === null) setEditingClassroom(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar turma</DialogTitle>
                <DialogDescription>Atualize o nome ou o código da turma. Os vínculos acadêmicos existentes serão preservados.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input value={editingClassroom?.name ?? ""} onChange={e => setEditingClassroom(v => v ? { ...v, name: e.target.value } : v)} placeholder="Nome da turma" />
                <Input value={editingClassroom?.code ?? ""} onChange={e => setEditingClassroom(v => v ? { ...v, code: e.target.value } : v)} placeholder="Código (opcional)" />
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={busyAction !== null} onClick={() => setEditingClassroom(null)}>Cancelar</Button>
                <Button disabled={busyAction !== null || !editingClassroom?.name.trim()} onClick={() => void saveClassroomEdit()}>{busyAction?.startsWith("edit-classroom:") ? "Salvando…" : "Salvar alterações"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmActionDialog
            open={!!periodAction}
            onOpenChange={open => { if (!open && periodBusy === null) setPeriodAction(null); }}
            title={periodAction?.closed ? "Encerrar período acadêmico?" : "Reabrir período acadêmico?"}
            description={periodAction?.closed
              ? "Ao encerrar este período, professores não poderão criar, alterar ou limpar notas oficiais do diário. Os dados continuarão disponíveis para consulta. A operação fica registrada no histórico administrativo."
              : "Ao reabrir este período, professores autorizados voltarão a poder lançar e corrigir as notas oficiais. Faça isso somente após conferir a necessidade de ajuste."
            }
            actionLabel={periodAction?.closed ? "Encerrar período" : "Reabrir período"}
            loading={periodBusy !== null}
            onConfirm={async () => {
              if (!periodAction) return;
              const action = periodAction;
              setPeriodBusy(action.period);
              try {
                await setAdminAcademicPeriodLock(action.period, action.closed);
                await periodLocks.refetch();
                setPeriodAction(null);
                toast.success(action.closed ? "Período encerrado." : "Período reaberto.");
              } catch (error) {
                toast.error(errorText(error));
              } finally {
                setPeriodBusy(null);
              }
            }}
          />

          <ConfirmActionDialog
            open={!!confirmDeleteClassroom}
            onOpenChange={open => { if (!open && busyAction === null) setConfirmDeleteClassroom(null); }}
            title="Excluir turma definitivamente?"
            description={'A turma "' + (confirmDeleteClassroom?.name ?? "") + '" só pode ser excluída se não tiver alunos, professores, disciplinas, atividades, avaliações, frequência ou eventos vinculados. Caso existam dados, o SINA impedirá a exclusão e recomendará arquivar a turma.'}
            actionLabel="Excluir turma"
            loading={busyAction?.startsWith("delete-classroom:") ?? false}
            onConfirm={deleteClassroom}
          />

          <ConfirmActionDialog
            open={!!confirmRemoveSubjectTeacher}
            onOpenChange={open => { if (!open && busyAction === null) setConfirmRemoveSubjectTeacher(null); }}
            title="Remover professor da disciplina?"
            description={confirmRemoveSubjectTeacher ? `O professor ${confirmRemoveSubjectTeacher.teacherName} será desvinculado de ${confirmRemoveSubjectTeacher.subjectName}. Se ele for o responsável atual e houver outro professor, primeiro transfira a responsabilidade.` : ""}
            actionLabel="Remover vínculo"
            loading={busyAction?.startsWith("remove-subject-teacher:") ?? false}
            onConfirm={() => void removeSubjectTeacher()}
          />

          <ConfirmActionDialog
            open={!!confirmDeleteSubject}
            onOpenChange={open => { if (!open && busyAction === null) setConfirmDeleteSubject(null); }}
            title="Excluir disciplina?"
            description={'A disciplina "' + (confirmDeleteSubject?.name ?? "") + '" será excluída e seus vínculos com as turmas serão removidos. Essa ação não pode ser desfeita.'}
            actionLabel="Excluir disciplina"
            loading={busyAction?.startsWith("delete-subject:") ?? false}
            onConfirm={deleteSubject}
          />

          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2"><Mail className="size-4 text-primary" /><p className="font-semibold">Convites institucionais</p></div>
            <p className="mt-1 text-sm text-muted-foreground">Convide professores ou alunos para a instituição. O convite expira em 72 horas e fica limitado à escola ativa.</p>
            <div className="mt-4 grid gap-2 md:grid-cols-[1.5fr_180px_1fr_auto]">
              <Input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="E-mail do convidado" type="email" />
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value as "teacher"|"student")} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="teacher">Professor</option><option value="student">Aluno</option></select>
              <select value={inviteClassroom} onChange={e=>setInviteClassroom(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem turma específica</option>{(setup.data?.classrooms??[]).filter(c=>c.status==="active").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Button disabled={inviteBusy||!inviteEmail.trim()} onClick={async()=>{setInviteBusy(true);try{const result=await createAdminInstitutionInvitation(inviteEmail.trim(),inviteRole,inviteClassroom||null,72);setGeneratedToken(result?.token??null);setInviteEmail("");await invitations.refetch();toast.success("Convite criado. Copie o token para enviar ao convidado.");}catch(error){toast.error(errorText(error));}finally{setInviteBusy(false);}}}>{inviteBusy?"Criando…":"Criar convite"}</Button>
            </div>
            {generatedToken&&<div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-semibold">Token do convite</p>
              <p className="mt-1 break-all font-mono text-xs">{generatedToken}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void navigator.clipboard.writeText(generatedToken).then(()=>toast.success("Token copiado."))}><Copy className="mr-2 size-4"/>Copiar token</Button><Button size="sm" variant="ghost" onClick={()=>setGeneratedToken(null)}>Fechar</Button></div>
            </div>}
            <div className="mt-4 space-y-2">
              {(invitations.data??[]).map(inv=><div key={inv.id} className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{inv.email} · {inv.role==="teacher"?"Professor":"Aluno"}</p><p className="text-xs text-muted-foreground">{inv.classroom_name||"Sem turma"} · {inv.accepted_at?"Aceito":inv.revoked_at?"Revogado":new Date(inv.expires_at)<new Date()?"Expirado":"Pendente"}</p></div>
                {!inv.accepted_at&&!inv.revoked_at&&new Date(inv.expires_at)>=new Date()&&<Button size="sm" variant="ghost" onClick={async()=>{try{await revokeAdminInstitutionInvitation(inv.id);await invitations.refetch();toast.success("Convite revogado.");}catch(error){toast.error(errorText(error));}}}><X className="mr-1 size-4"/>Revogar</Button>}
              </div>)}
              {!invitations.isPending&&!invitations.data?.length&&<p className="text-sm text-muted-foreground">Nenhum convite criado.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2"><Users className="size-4 text-primary" /><p className="font-semibold">Professores e turmas</p></div>
            <p className="mt-1 text-sm text-muted-foreground">Vincule professores às turmas para liberar lançamento de notas, frequência, atividades e avisos.</p>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione o professor</option>
                {(teachers.data ?? []).map(t => <option key={t.user_id} value={t.user_id}>{t.display_name || t.email}</option>)}
              </select>
              <select value={teacherClassroomId} onChange={e => setTeacherClassroomId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione a turma</option>
                {(setup.data?.classrooms ?? []).filter(c => c.status === "active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={() => void assignTeacher()} disabled={busyAction !== null || !teacherId || !teacherClassroomId}>{busyAction === "assign-teacher" ? "Vinculando…" : "Vincular"}</Button>
            </div>
            <div className="mt-4 space-y-2">
              {(assignments.data ?? []).map(a => <div key={a.classroom_id + a.teacher_id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3 text-sm"><div><p className="font-medium">{a.teacher_name || a.teacher_email}</p><p className="text-xs text-muted-foreground">{a.classroom_name}</p></div><Button size="sm" variant="ghost" disabled={busyAction !== null} onClick={() => void unassignTeacher(a.teacher_id, a.classroom_id)}>{busyAction === "unassign:"+a.teacher_id+":"+a.classroom_id ? "Removendo…" : "Remover"}</Button></div>)}
              {!assignments.isPending && !assignments.data?.length && <p className="text-sm text-muted-foreground">Nenhum professor vinculado a uma turma ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}