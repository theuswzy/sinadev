import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserRoundPlus, Link2, Users, ClipboardList, Save, ShieldCheck, Search, CheckCircle2, AlertCircle, BarChart3, Megaphone, ClipboardCheck, Filter, UsersRound, Paperclip, UserMinus, ArrowRightLeft, X } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadStudents } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/professor")({
  head: () => ({ meta: [{ title: "Área do professor — SINA" }, { name: "description", content: "Vincule alunos a turmas e matrículas e registre dados acadêmicos." }] }),
  component: TeacherArea,
});

function TeacherArea() {
  const queryClient = useQueryClient();
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const students = useQuery({ queryKey: ["teacher-students"], queryFn: loadStudents, enabled: role.data === "teacher" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.data?.find(s => s.id === selectedId) ?? null;
  const grades = useQuery({ queryKey: ["grades", selectedId], queryFn: () => loadGrades(selectedId ?? ""), enabled: !!selectedId && !!selected?.teacher_id && role.data === "teacher" });

  const [enrollment, setEnrollment] = useState("");
  const [classroom, setClassroom] = useState("");
  const [subject, setSubject] = useState("");
  const [period, setPeriod] = useState("1");
  const [score, setScore] = useState("");
  const [absences, setAbsences] = useState("0");
  const [attendance, setAttendance] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [bulkClassroom, setBulkClassroom] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkPeriod, setBulkPeriod] = useState("1");
  const [bulkScores, setBulkScores] = useState<Record<string, string>>({});
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [noticeClassroom, setNoticeClassroom] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [taskClassroom, setTaskClassroom] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskFile, setTaskFile] = useState<File | null>(null);

  async function linkStudent(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const wasLinked = Boolean(selected.teacher_id);
    setBusy(true); setMessage(""); setMessageType("success");
    const { data, error } = await supabase.rpc("teacher_link_student", {
      _student_id: selected.id,
      _enrollment: enrollment.trim(),
      _classroom: classroom.trim(),
    });
    setBusy(false);
    if (error) {
      setMessageType("error");
      setMessage(errorText(error));
      toast.error(errorText(error));
      return;
    }
    if (!data) {
      setMessageType("error");
      setMessage("Não foi possível salvar o vínculo do aluno.");
      return;
    }
    setMessage(wasLinked ? "Turma e matrícula atualizadas." : "Aluno vinculado à turma e à matrícula.");
    toast.success(wasLinked ? "Vínculo atualizado." : "Aluno vinculado com sucesso.");
    await queryClient.invalidateQueries({ queryKey: ["teacher-students"] });
    setSelectedId(selected.id);
  }

  async function unlinkStudent() {
    if (!selected?.teacher_id) return;
    const confirmed = window.confirm(
      "Remover " + selected.full_name + " desta turma? Isso apenas remove o vínculo com você; a conta e as notas do aluno não serão apagadas.",
    );
    if (!confirmed) return;

    setBusy(true); setMessage(""); setMessageType("success");
    const { data, error } = await supabase.rpc("teacher_unlink_student", {
      _student_id: selected.id,
    });
    setBusy(false);

    if (error) {
      setMessageType("error");
      setMessage(errorText(error));
      toast.error(errorText(error));
      return;
    }

    if (!data) {
      setMessageType("error");
      setMessage("Não foi possível remover o vínculo do aluno.");
      return;
    }

    setEnrollment("");
    setClassroom("");
    setAttendance("");
    setMessage("Aluno removido da sua turma. Nenhum dado acadêmico foi apagado.");
    toast.success("Aluno removido da turma.");
    await queryClient.invalidateQueries({ queryKey: ["teacher-students"] });
    setSelectedId(selected.id);
  }


  async function saveAttendance(e: FormEvent) {
    e.preventDefault();
    if (!selected?.teacher_id) return;
    const value = Number(attendance.replace(",", "."));
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("teacher_update_attendance", { _student_id: selected.id, _attendance: value });
    setBusy(false);
    if (error) setMessageType("error");
    setMessage(error ? errorText(error) : "Frequência atualizada.");
    if (error) toast.error(errorText(error)); else toast.success("Frequência atualizada.");
    if (!error) await queryClient.invalidateQueries({ queryKey: ["teacher-students"] });
  }

  async function saveGrade(e: FormEvent) {
    e.preventDefault();
    if (!selected?.teacher_id) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("teacher_upsert_grade", {
      _student_id: selected.id,
      _subject: subject.trim(),
      _period: Number(period),
      _score: Number(score.replace(",", ".")),
      _absences: Number(absences),
    });
    setBusy(false);
    if (error) { setMessage(errorText(error)); return; }
    setMessage("Nota registrada.");
    toast.success("Nota registrada com sucesso.");
    setSubject(""); setScore(""); setAbsences("0");
    await queryClient.invalidateQueries({ queryKey: ["grades", selected.id] });
  }


  async function saveBulkGrades(e: FormEvent) {
    e.preventDefault();
    if (!bulkClassroom || !bulkSubject.trim()) return;
    const entries = linked.filter(s => s.classroom === bulkClassroom && bulkScores[s.id]?.trim() !== "");
    if (!entries.length) {
      setMessageType("error");
      setMessage("Informe pelo menos uma nota para a turma.");
      return;
    }

    setBusy(true);
    setMessage("");
    setMessageType("success");

    try {
      const normalizedSubject = bulkSubject.trim().toLowerCase();
      const periodNumber = Number(bulkPeriod);
      const entriesWithAbsences = await Promise.all(
        entries.map(async (student) => {
          const existingGrades = await loadGrades(student.id);
          const existing = existingGrades.find(
            (grade) => grade.subject.trim().toLowerCase() === normalizedSubject && grade.period === periodNumber,
          );
          return { student, absences: existing?.absences ?? 0 };
        }),
      );

      for (const { student, absences } of entriesWithAbsences) {
        const { error } = await supabase.rpc("teacher_upsert_grade", {
          _student_id: student.id,
          _subject: bulkSubject.trim(),
          _period: periodNumber,
          _score: Number(bulkScores[student.id].replace(",", ".")),
          _absences: absences,
        });
        if (error) throw error;
      }
    } catch (error) {
      setBusy(false);
      setMessageType("error");
      setMessage(errorText(error));
      toast.error("Não foi possível concluir todos os lançamentos.");
      return;
    }
    setBusy(false);
    setBulkScores({});
    setMessage("Lançamento em lote concluído.");
    toast.success(`${entries.length} nota${entries.length === 1 ? "" : "s"} lançada${entries.length === 1 ? "" : "s"} com sucesso.`);
    await queryClient.invalidateQueries({ queryKey: ["grades"] });
  }

  const attachmentAccept = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

  async function uploadAcademicAttachment(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("O arquivo precisa ter no máximo 20 MB.");
    }

    const allowedTypes = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);

    if (file.type && !allowedTypes.has(file.type)) {
      throw new Error("Tipo de arquivo não permitido. Use PDF, imagem, Word, PowerPoint, Excel ou TXT.");
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sua sessão expirou. Entre novamente.");

    const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "bin";
    const filePath = extension
      ? auth.user.id + "/" + crypto.randomUUID() + "." + extension
      : auth.user.id + "/" + crypto.randomUUID();

    const { error } = await supabase.storage.from("academic-attachments").upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    return {
      path: filePath,
      name: file.name,
      size: file.size,
      type: file.type || null,
    };
  }

  async function removeAcademicAttachment(path: string | null) {
    if (!path) return;
    await supabase.storage.from("academic-attachments").remove([path]);
  }

  async function createAnnouncement(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(""); setMessageType("success");
    let uploadedPath: string | null = null;

    try {
      const attachment = noticeFile ? await uploadAcademicAttachment(noticeFile) : null;
      uploadedPath = attachment?.path ?? null;

      const { error } = await supabase.rpc("teacher_create_announcement", {
        _classroom: noticeClassroom.trim(),
        _title: noticeTitle.trim(),
        _content: noticeContent.trim(),
        _attachment_path: attachment?.path ?? null,
        _attachment_name: attachment?.name ?? null,
        _attachment_size: attachment?.size ?? null,
        _attachment_type: attachment?.type ?? null,
      });

      if (error) throw error;

      setNoticeTitle("");
      setNoticeContent("");
      setNoticeFile(null);
      setMessage("Aviso publicado para a turma.");
      toast.success("Aviso publicado para a turma.");
    } catch (error) {
      if (uploadedPath) await removeAcademicAttachment(uploadedPath);
      setMessageType("error");
      setMessage(errorText(error));
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(""); setMessageType("success");
    let uploadedPath: string | null = null;

    try {
      const due = taskDueAt ? new Date(taskDueAt).toISOString() : null;
      const attachment = taskFile ? await uploadAcademicAttachment(taskFile) : null;
      uploadedPath = attachment?.path ?? null;

      const { error } = await supabase.rpc("teacher_create_task", {
        _classroom: taskClassroom.trim(),
        _subject: taskSubject.trim(),
        _title: taskTitle.trim(),
        _description: taskDescription.trim(),
        _due_at: due,
        _attachment_path: attachment?.path ?? null,
        _attachment_name: attachment?.name ?? null,
        _attachment_size: attachment?.size ?? null,
        _attachment_type: attachment?.type ?? null,
      });

      if (error) throw error;

      setTaskSubject("");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueAt("");
      setTaskFile(null);
      setMessage("Atividade publicada para a turma.");
      toast.success("Atividade publicada para a turma.");
    } catch (error) {
      if (uploadedPath) await removeAcademicAttachment(uploadedPath);
      setMessageType("error");
      setMessage(errorText(error));
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }


  const unlinked = students.data?.filter(s => !s.teacher_id) ?? [];
  const linked = students.data?.filter(s => s.teacher_id) ?? [];
  const filteredUnlinked = unlinked.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()));
  const classrooms = Array.from(new Set(linked.map(s => s.classroom).filter(Boolean))).sort();
  const visibleLinked = classFilter === "all" ? linked : linked.filter(s => s.classroom === classFilter);
  const filteredLinked = visibleLinked.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()));
  const classStudents = linked.filter(s => s.classroom === bulkClassroom);
  const selectedSubjects = selected?.teacher_id && grades.data ? Array.from(new Set(grades.data.map(g => g.subject))).map(subject => {
    const items = grades.data?.filter(g => g.subject === subject) ?? [];
    return { subject, average: items.reduce((sum, item) => sum + item.score, 0) / items.length, absences: items.reduce((sum, item) => sum + item.absences, 0), periods: items.length };
  }) : [];
  const classWithAttendance = visibleLinked.filter(s => s.attendance !== null).length;
  const averageAttendance = classWithAttendance ? visibleLinked.reduce((sum, s) => sum + (s.attendance ?? 0), 0) / classWithAttendance : 0;

  return <AcademicShell title="Área do professor" subtitle="Turmas e acompanhamento acadêmico">
    {role.isPending ? <p className="mt-8 text-muted-foreground">Verificando acesso…</p> : role.error ? <p role="alert" className="mt-8 text-destructive">{errorText(role.error)}</p> : role.data !== "teacher" ? (
      <div className="mt-8 sina-card sina-card-hover p-6">
        <ShieldCheck className="size-6 text-primary" /><p className="mt-3 font-semibold">Acesso reservado a professores autorizados.</p><p className="mt-1 text-sm text-muted-foreground">Sua conta não possui autorização de professor.</p><Link to={role.data === "admin" ? "/admin" : "/aluno"} className="mt-4 inline-block text-sm text-primary underline">Voltar para minha área</Link>
      </div>
    ) : <>
      {students.isPending && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Carregando dados">
          {[1, 2, 3, 4].map((item) => <div key={item} className="sina-card p-5"><div className="sina-skeleton size-8" /><div className="sina-skeleton mt-5 h-3 w-28" /><div className="sina-skeleton mt-3 h-8 w-14" /></div>)}
        </div>
      )}
      <section id="inicio" className="mt-8 scroll-mt-28 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sina-card sina-card-hover sina-interactive p-5"><UserRoundPlus className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Aguardando vínculo</p><p className="mt-1 font-display text-3xl font-semibold">{unlinked.length}</p><p className="mt-1 text-xs text-muted-foreground">Alunos que já criaram conta</p></div>
        <div className="sina-card sina-card-hover sina-interactive p-5"><Users className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Meus alunos</p><p className="mt-1 font-display text-3xl font-semibold">{linked.length}</p><p className="mt-1 text-xs text-muted-foreground">Vinculados às minhas turmas</p></div>
        <div className="sina-card sina-card-hover sina-interactive p-5"><ClipboardList className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Turmas</p><p className="mt-1 font-display text-3xl font-semibold">{classrooms.length}</p><p className="mt-1 text-xs text-muted-foreground">Turmas com alunos vinculados</p></div>
        <div className="sina-card sina-card-hover sina-interactive p-5"><BarChart3 className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Frequência média</p><p className="mt-1 font-display text-3xl font-semibold">{classWithAttendance ? `${formatScore(averageAttendance)}%` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{classWithAttendance ? `${classWithAttendance} aluno${classWithAttendance === 1 ? "" : "s"} com dados` : "Aguardando registros"}</p></div>
      </section>

      <section id="alunos" className="mt-6 scroll-mt-28 sina-card sina-card-hover">
        <div className="border-b border-border p-6"><div className="flex items-center gap-3"><Link2 className="size-5 text-primary" /><div><h2 className="font-semibold">Alunos aguardando vínculo</h2><p className="mt-1 text-sm text-muted-foreground">Selecione um aluno que já possui conta e informe a turma e a matrícula.</p></div></div></div>
        <div className="border-b border-border p-4"><div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Buscar aluno pelo nome…" className="pl-9" /></div></div>
        <div className="p-6">
          {students.isPending ? <p className="text-sm text-muted-foreground">Carregando…</p> : filteredUnlinked.length ? <div className="grid gap-3 md:grid-cols-2">{filteredUnlinked.map(s => <button key={s.id} type="button" onClick={() => {
                  setSelectedId(s.id);
                  setEnrollment(s.enrollment || "");
                  setClassroom(s.classroom || "");
                  setAttendance(s.attendance === null ? "" : String(s.attendance));
                  setMessage("");
                }} className={`sina-interactive rounded-2xl border p-4 text-left hover:border-primary hover:shadow-sm ${selectedId === s.id ? "border-primary bg-primary/5" : "border-border"}`}><p className="font-semibold">{s.full_name}</p><p className="mt-1 text-xs text-muted-foreground">Conta criada · aguardando turma e matrícula</p></button>)}</div> : <div className="rounded-xl bg-secondary/50 p-5 text-sm text-muted-foreground">Não há alunos aguardando vínculo.</div>}
        </div>
      </section>

      {selected && !selected.teacher_id && <section className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <h2 className="font-semibold">Vincular {selected.full_name}</h2>
        <form onSubmit={linkStudent} className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Matrícula<Input className="mt-2" required value={enrollment} onChange={e => setEnrollment(e.target.value)} placeholder="Ex.: 2026-001" /></label>
          <label className="text-sm font-medium">Turma<Input className="mt-2" required value={classroom} onChange={e => setClassroom(e.target.value)} placeholder="Ex.: Turma A" /></label>
          <div className="flex items-end"><Button type="submit" disabled={busy} className="w-full"><Link2 className="mr-2 size-4" />Vincular aluno</Button></div>
        </form>
      </section>}

      <section className="mt-6 sina-card sina-card-hover">
        <div className="border-b border-border p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Meus alunos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Filtre por turma ou pesquise pelo nome para encontrar rapidamente um aluno.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="h-10 min-w-44 rounded-md border border-input bg-background pl-9 pr-3 text-sm" aria-label="Filtrar alunos por turma">
                  <option value="all">Todas as turmas</option>
                  {classrooms.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Buscar aluno…" className="pl-9" />
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-border bg-secondary/30 px-6 py-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredLinked.length}</span> aluno{filteredLinked.length === 1 ? "" : "s"} encontrado{filteredLinked.length === 1 ? "" : "s"}{classFilter !== "all" ? ` em ${classFilter}` : ""}
        </div>
        {filteredLinked.length ? (
          <div className="divide-y divide-border">
            {filteredLinked.map(s => (
              <button key={s.id} type="button" onClick={() => {
                setSelectedId(s.id);
                setEnrollment(s.enrollment || "");
                setClassroom(s.classroom || "");
                setAttendance(s.attendance === null ? "" : String(s.attendance));
                setMessage("");
              }} className={`flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-accent/50 ${selectedId === s.id ? "bg-accent/50" : ""}`}>
                <span>
                  <strong>{s.full_name}</strong>
                  <small className="mt-1 block text-muted-foreground">Turma {s.classroom} · Matrícula {s.enrollment}</small>
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {s.attendance === null ? "Freq. —" : `Freq. ${formatScore(s.attendance)}%`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <UsersRound className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum aluno encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste a turma ou o nome pesquisado.</p>
          </div>
        )}
      </section>

      {selected?.teacher_id && <section className="mt-5 sina-card sina-card-hover p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Gerenciar vínculo</p>
            <h2 className="mt-1 font-semibold">{selected.full_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Altere a turma ou a matrícula sem excluir o aluno da plataforma.</p>
          </div>
          <ArrowRightLeft className="size-5 text-primary" />
        </div>
        <form onSubmit={linkStudent} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <label className="text-sm font-medium">Matrícula
            <Input className="mt-2" required value={enrollment} onChange={e => setEnrollment(e.target.value)} placeholder="Ex.: 2026-001" />
          </label>
          <label className="text-sm font-medium">Turma
            <Input className="mt-2" required value={classroom} onChange={e => setClassroom(e.target.value)} placeholder="Ex.: Turma A" />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}><Save className="mr-2 size-4" />Salvar vínculo</Button>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void unlinkStudent()} className="border-destructive/30 text-destructive hover:bg-destructive/5">
              <UserMinus className="mr-2 size-4" />Remover da turma
            </Button>
          </div>
        </form>
      </section>}

      {linked.length > 0 && <section className="mt-5 sina-card sina-card-hover p-6">
        <div className="flex items-center gap-3"><UsersRound className="size-5 text-primary" /><div><h2 className="font-semibold">Lançamento rápido de notas</h2><p className="mt-1 text-sm text-muted-foreground">Preencha as notas de vários alunos da mesma turma em uma única tela.</p></div></div>
        <form onSubmit={saveBulkGrades} className="mt-5">
          <div className="grid gap-3 md:grid-cols-3">
            <select required value={bulkClassroom} onChange={e => { setBulkClassroom(e.target.value); setBulkScores({}); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a turma</option>{classrooms.map(item => <option key={item} value={item}>{item}</option>)}</select>
            <Input required placeholder="Disciplina" value={bulkSubject} onChange={e => setBulkSubject(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={bulkPeriod} onChange={e => setBulkPeriod(e.target.value)}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}º período</option>)}</select>
          </div>
          {bulkClassroom && <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-secondary/50"><tr><th className="p-3 text-left">Aluno</th><th className="p-3 text-left">Matrícula</th><th className="w-40 p-3 text-left">Nota</th></tr></thead><tbody>{classStudents.map(s => <tr key={s.id} className="border-t border-border"><td className="p-3 font-medium">{s.full_name}</td><td className="p-3 text-muted-foreground">{s.enrollment}</td><td className="p-3"><Input type="number" min="0" max="10" step="0.01" value={bulkScores[s.id] ?? ""} onChange={e => setBulkScores(prev => ({ ...prev, [s.id]: e.target.value }))} placeholder="0–10" /></td></tr>)}</tbody></table></div>}
          <Button type="submit" disabled={busy || !bulkClassroom || !classStudents.length} className="mt-4"><Save className="mr-2 size-4" />{busy ? "Lançando…" : "Lançar notas preenchidas"}</Button>
        </form>
      </section>}

      {selected?.teacher_id && <section className="mt-5 sina-card sina-card-hover p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Acompanhamento</p><h2 className="mt-1 font-semibold">Desempenho por disciplina</h2><p className="mt-1 text-sm text-muted-foreground">{selected.full_name} · visão consolidada das disciplinas com notas lançadas.</p></div><BarChart3 className="size-5 text-primary" /></div>
        {selectedSubjects.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedSubjects.map(item => <div key={item.subject} className="rounded-2xl border border-border p-4"><div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{item.subject}</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{formatScore(item.average)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.average * 10)}%` }} /></div><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{item.periods} lançamento{item.periods === 1 ? "" : "s"}</span><span>{item.absences} falta{item.absences === 1 ? "" : "s"}</span></div></div>)}</div> : <div className="mt-5 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Ainda não há notas lançadas para este aluno.</div>}
      </section>}

      {selected?.teacher_id && <section id="lancamentos" className="mt-5 scroll-mt-28 grid gap-5 lg:grid-cols-2">
        <div className="sina-card sina-card-hover p-6">
          <h2 className="font-semibold">Frequência de {selected.full_name}</h2>
          <form onSubmit={saveAttendance} className="mt-4 flex gap-3"><Input type="number" min="0" max="100" step="0.01" required value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="0 a 100%" /><Button type="submit" disabled={busy}><Save className="mr-2 size-4" />{busy ? "Salvando…" : "Salvar"}</Button></form>
        </div>
        <div className="sina-card sina-card-hover p-6">
          <h2 className="font-semibold">Lançar nota</h2>
          <form onSubmit={saveGrade} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input required placeholder="Disciplina" value={subject} onChange={e => setSubject(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={period} onChange={e => setPeriod(e.target.value)}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}º período</option>)}</select>
            <Input required type="number" min="0" max="10" step="0.01" placeholder="Nota" value={score} onChange={e => setScore(e.target.value)} />
            <Input required type="number" min="0" step="1" placeholder="Faltas" value={absences} onChange={e => setAbsences(e.target.value)} />
            <Button type="submit" disabled={busy} className="sm:col-span-2"><Save className="mr-2 size-4" />{busy ? "Salvando…" : "Salvar nota"}</Button>
          </form>
          {grades.data?.length ? <div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Disciplina</th><th className="py-2">Período</th><th className="py-2">Nota</th></tr></thead><tbody>{grades.data.map(g => <tr key={g.id} className="border-b border-border"><td className="py-2">{g.subject}</td><td className="py-2">{g.period}º</td><td className="py-2 font-semibold">{formatScore(g.score)}</td></tr>)}</tbody></table></div> : null}
        </div>
      </section>}
      <section id="comunicacao" className="mt-6 scroll-mt-28 grid gap-5 lg:grid-cols-2">
        <div className="sina-card sina-card-hover p-6 shadow-sm">
          <div className="flex items-center gap-3"><Megaphone className="size-5 text-primary" /><div><h2 className="font-semibold">Quadro de avisos</h2><p className="mt-1 text-sm text-muted-foreground">Publique um comunicado para uma das suas turmas.</p></div></div>
          <form onSubmit={createAnnouncement} className="mt-5 space-y-3">
            <select required value={noticeClassroom} onChange={e => setNoticeClassroom(e.target.value)} disabled={!classrooms.length} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
              <option value="">{classrooms.length ? "Selecione a turma" : "Nenhuma turma disponível"}</option>
              {classrooms.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input required value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="Título do aviso" />
            <textarea required maxLength={2000} value={noticeContent} onChange={e => setNoticeContent(e.target.value)} placeholder="Escreva o comunicado..." className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Paperclip className="size-4 text-primary" />
                  Anexar arquivo
                  <input key={noticeFile ? "notice-file" : "notice-empty"} type="file" accept={attachmentAccept} className="sr-only" onChange={e => setNoticeFile(e.target.files?.[0] ?? null)} />
                </label>
                {noticeFile && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setNoticeFile(null)} aria-label="Remover anexo"><X className="size-4" /></button>}
              </div>
              {noticeFile && <p className="mt-2 truncate text-xs text-muted-foreground">{noticeFile.name} · {(noticeFile.size / 1024 / 1024).toFixed(1)} MB</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">PDF, imagem, Word, PowerPoint, Excel ou TXT · até 20 MB.</p>
            </div>
            <Button type="submit" disabled={busy || !noticeClassroom}><Megaphone className="mr-2 size-4" />{busy ? "Publicando…" : "Publicar aviso"}</Button>
          </form>
        </div>
        <div className="sina-card sina-card-hover p-6 shadow-sm">
          <div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-primary" /><div><h2 className="font-semibold">Nova tarefa</h2><p className="mt-1 text-sm text-muted-foreground">Crie uma atividade com disciplina e prazo.</p></div></div>
          <form onSubmit={createTask} className="mt-5 space-y-3">
            <select required value={taskClassroom} onChange={e => setTaskClassroom(e.target.value)} disabled={!classrooms.length} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
              <option value="">{classrooms.length ? "Selecione a turma" : "Nenhuma turma disponível"}</option>
              {classrooms.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="grid gap-3 sm:grid-cols-2"><Input required value={taskSubject} onChange={e => setTaskSubject(e.target.value)} placeholder="Disciplina" /><Input required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título da tarefa" /></div>
            <textarea maxLength={4000} value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Descrição e orientações..." className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <Input type="datetime-local" value={taskDueAt} onChange={e => setTaskDueAt(e.target.value)} />
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Paperclip className="size-4 text-primary" />
                  Anexar arquivo
                  <input key={taskFile ? "task-file" : "task-empty"} type="file" accept={attachmentAccept} className="sr-only" onChange={e => setTaskFile(e.target.files?.[0] ?? null)} />
                </label>
                {taskFile && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setTaskFile(null)} aria-label="Remover anexo"><X className="size-4" /></button>}
              </div>
              {taskFile && <p className="mt-2 truncate text-xs text-muted-foreground">{taskFile.name} · {(taskFile.size / 1024 / 1024).toFixed(1)} MB</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">PDF, imagem, Word, PowerPoint, Excel ou TXT · até 20 MB.</p>
            </div>
            <Button type="submit" disabled={busy || !taskClassroom}><ClipboardCheck className="mr-2 size-4" />{busy ? "Publicando…" : "Publicar atividade"}</Button>
          </form>
        </div>
      </section>

      {message && <div role={messageType === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${messageType === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-foreground"}`}>{messageType === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}<span>{message}</span></div>}
    </>}
  </AcademicShell>;
}
