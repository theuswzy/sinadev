import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { UserRoundPlus, Link2, Users, ClipboardList, Save, ShieldCheck, Search, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadStudents, type Student } from "@/lib/sina-data";

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
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function linkStudent(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setMessage(""); setMessageType("success");
    const { data, error } = await supabase.rpc("teacher_link_student", {
      _student_id: selected.id,
      _enrollment: enrollment.trim(),
      _classroom: classroom.trim(),
    });
    setBusy(false);
    if (error) { setMessageType("error"); setMessage(errorText(error)); return; }
    if (!data) { setMessageType("error"); setMessage("Não foi possível vincular o aluno."); return; }
    setEnrollment(""); setClassroom("");
    setMessage("Aluno vinculado à turma e à matrícula.");
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
    setSubject(""); setScore(""); setAbsences("0");
    await queryClient.invalidateQueries({ queryKey: ["grades", selected.id] });
  }

  const unlinked = students.data?.filter(s => !s.teacher_id) ?? [];
  const linked = students.data?.filter(s => s.teacher_id) ?? [];
  const filteredUnlinked = unlinked.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()));
  const filteredLinked = linked.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()));

  return <AcademicShell title="Área do professor" subtitle="Turmas e acompanhamento acadêmico">
    {role.isPending ? <p className="mt-8 text-muted-foreground">Verificando acesso…</p> : role.error ? <p role="alert" className="mt-8 text-destructive">{errorText(role.error)}</p> : role.data !== "teacher" ? (
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <ShieldCheck className="size-6 text-primary" /><p className="mt-3 font-semibold">Acesso reservado a professores autorizados.</p><p className="mt-1 text-sm text-muted-foreground">Solicite autorização ao administrador do SINA.</p><Link to="/painel" className="mt-4 inline-block text-sm text-primary underline">Voltar ao painel</Link>
      </div>
    ) : <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5"><UserRoundPlus className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Aguardando vínculo</p><p className="mt-1 font-display text-3xl font-semibold">{unlinked.length}</p><p className="mt-1 text-xs text-muted-foreground">Alunos que já criaram conta</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><Users className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Meus alunos</p><p className="mt-1 font-display text-3xl font-semibold">{linked.length}</p><p className="mt-1 text-xs text-muted-foreground">Vinculados às minhas turmas</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><ClipboardList className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Fluxo</p><p className="mt-1 text-sm font-semibold">Conta → turma → matrícula</p><p className="mt-1 text-xs text-muted-foreground">O aluno cria a conta; o professor completa o vínculo.</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><BarChart3 className="size-5 text-primary" /><p className="mt-3 text-xs font-bold uppercase text-muted-foreground">Acompanhamento</p><p className="mt-1 font-display text-3xl font-semibold">{linked.filter(s => s.attendance !== null).length}</p><p className="mt-1 text-xs text-muted-foreground">Alunos com frequência registrada</p></div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6"><div className="flex items-center gap-3"><Link2 className="size-5 text-primary" /><div><h2 className="font-semibold">Alunos aguardando vínculo</h2><p className="mt-1 text-sm text-muted-foreground">Selecione um aluno que já possui conta e informe a turma e a matrícula.</p></div></div></div>
        <div className="border-b border-border p-4"><div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Buscar aluno pelo nome…" className="pl-9" /></div></div>
        <div className="p-6">
          {students.isPending ? <p className="text-sm text-muted-foreground">Carregando…</p> : filteredUnlinked.length ? <div className="grid gap-3 md:grid-cols-2">{filteredUnlinked.map(s => <button key={s.id} type="button" onClick={() => { setSelectedId(s.id); setMessage(""); }} className={`rounded-xl border p-4 text-left transition-colors hover:border-primary ${selectedId === s.id ? "border-primary bg-primary/5" : "border-border"}`}><p className="font-semibold">{s.full_name}</p><p className="mt-1 text-xs text-muted-foreground">Conta criada · aguardando turma e matrícula</p></button>)}</div> : <div className="rounded-xl bg-secondary/50 p-5 text-sm text-muted-foreground">Não há alunos aguardando vínculo.</div>}
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

      <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6"><h2 className="font-semibold">Meus alunos</h2><p className="mt-1 text-sm text-muted-foreground">Somente alunos vinculados a você aparecem nesta lista.</p></div>
        {filteredLinked.length ? <div className="divide-y divide-border">{filteredLinked.map(s => <button key={s.id} type="button" onClick={() => { setSelectedId(s.id); setAttendance(s.attendance === null ? "" : String(s.attendance)); setMessage(""); }} className={`flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-accent/40 ${selectedId === s.id ? "bg-accent/50" : ""}`}><span><strong>{s.full_name}</strong><small className="mt-1 block text-muted-foreground">Turma {s.classroom} · Matrícula {s.enrollment}</small></span><span className="text-xs text-muted-foreground">{s.attendance === null ? "Freq. —" : `Freq. ${formatScore(s.attendance)}%`}</span></button>)}</div> : <p className="p-6 text-sm text-muted-foreground">Nenhum aluno vinculado ainda.</p>}
      </section>

      {selected?.teacher_id && <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Frequência de {selected.full_name}</h2>
          <form onSubmit={saveAttendance} className="mt-4 flex gap-3"><Input type="number" min="0" max="100" step="0.01" required value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="0 a 100%" /><Button type="submit" disabled={busy}><Save className="mr-2 size-4" />{busy ? "Salvando…" : "Salvar"}</Button></form>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
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
      {message && <div role={messageType === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${messageType === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-foreground"}`}>{messageType === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}<span>{message}</span></div>}
    </>}
  </AcademicShell>;
}
