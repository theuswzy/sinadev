import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadStudents, type Student } from "@/lib/sina-data";
export const Route = createFileRoute("/_authenticated/professor")({ head: () => ({ meta: [{ title: "Área do professor — SINA" }, { name: "description", content: "Cadastre alunos, registre notas e acompanhe a frequência no SINA." }, { property: "og:title", content: "Área do professor — SINA" }, { property: "og:description", content: "Registro de notas e acompanhamento acadêmico do professor." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: TeacherArea });
function TeacherArea() {
  const queryClient = useQueryClient();
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const students = useQuery({ queryKey: ["teacher-students"], queryFn: loadStudents, enabled: role.data === "teacher" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.data?.find(s => s.id === selectedId) ?? null;
  const grades = useQuery({ queryKey: ["grades", selectedId], queryFn: () => loadGrades(selectedId ?? ""), enabled: !!selectedId && role.data === "teacher" });
  const [name, setName] = useState(""); const [enrollment, setEnrollment] = useState(""); const [classroom, setClassroom] = useState("");
  const [subject, setSubject] = useState(""); const [period, setPeriod] = useState("1"); const [score, setScore] = useState(""); const [absences, setAbsences] = useState("0");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function createStudent(e: FormEvent) {
    e.preventDefault(); setMessage(""); setBusy(true);
    try { const { data: auth, error: authError } = await supabase.auth.getUser(); if (authError || !auth.user) throw new Error("Sessão encerrada. Entre novamente.");
      const { data, error } = await supabase.from("students").insert({ teacher_id: auth.user.id, full_name: name.trim(), enrollment: enrollment.trim(), classroom: classroom.trim() }).select().single();
      if (error) throw error; setName(""); setEnrollment(""); setClassroom(""); setSelectedId(data.id); await queryClient.invalidateQueries({ queryKey: ["teacher-students"] }); setMessage("Aluno cadastrado. Entregue o código de vinculação apenas a ele.");
    } catch (err) { setMessage(errorText(err)); } finally { setBusy(false); }
  }
  async function updateAttendance(student: Student, value: string) {
    const attendance = Number(value.replace(",", ".")); if (!Number.isFinite(attendance) || attendance < 0 || attendance > 100) { setMessage("Informe uma frequência entre 0 e 100."); return; }
    const { error } = await supabase.from("students").update({ attendance }).eq("id", student.id);
    setMessage(error ? errorText(error) : "Frequência atualizada."); if (!error) await queryClient.invalidateQueries({ queryKey: ["teacher-students"] });
  }
  async function saveGrade(e: FormEvent) {
    e.preventDefault(); if (!selected) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("grades").upsert({ student_id: selected.id, subject: subject.trim(), period: Number(period), score: Number(score.replace(",", ".")), absences: Number(absences) }, { onConflict: "student_id,subject,period" });
    setBusy(false); if (error) setMessage(errorText(error)); else { setMessage("Nota registrada."); setSubject(""); setScore(""); setAbsences("0"); await queryClient.invalidateQueries({ queryKey: ["grades", selected.id] }); }
  }
  return <AcademicShell title="Área do professor" subtitle="Alunos e lançamentos">
    {role.isPending ? <p className="mt-8 text-muted-foreground">Carregando…</p> : role.error ? <p role="alert" className="mt-8 text-destructive">{errorText(role.error)}</p> : role.data !== "teacher" ? <p className="mt-8 text-sm">Acesso reservado a professores autorizados. <Link to="/aluno" className="text-primary underline">Ir para minha área</Link></p> : <>
      <section className="mt-10 border-t border-border pt-6"><h2 className="text-xl font-semibold">Cadastrar aluno</h2><form onSubmit={createStudent} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Nome completo<Input className="mt-2" required value={name} onChange={e => setName(e.target.value)} /></label><label className="text-sm font-medium">Matrícula<Input className="mt-2" required value={enrollment} onChange={e => setEnrollment(e.target.value)} /></label><label className="text-sm font-medium">Turma<Input className="mt-2" required value={classroom} onChange={e => setClassroom(e.target.value)} /></label><div className="flex items-end"><Button type="submit" disabled={busy} className="w-full">Cadastrar</Button></div></form></section>
      <section className="mt-10"><h2 className="text-xl font-semibold">Meus alunos</h2>{students.isPending ? <p className="mt-5 text-muted-foreground">Carregando alunos…</p> : students.error ? <p role="alert" className="mt-5 text-destructive">{errorText(students.error)}</p> : students.data?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{students.data.map(student => <Button type="button" key={student.id} variant="outline" onClick={() => { setSelectedId(student.id); setMessage(""); }} className={`h-auto min-h-20 justify-start whitespace-normal p-4 text-left ${selectedId === student.id ? "border-primary bg-accent" : ""}`}><span className="flex flex-col items-start"><strong>{student.full_name}</strong><small className="text-muted-foreground">{student.classroom} · Mat. {student.enrollment}</small></span></Button>)}</div> : <p className="mt-5 text-sm text-muted-foreground">Nenhum aluno cadastrado.</p>}</section>
      {selected && <section className="mt-10 border-t border-border pt-6"><h2 className="text-xl font-semibold">{selected.full_name}</h2><p className="mt-1 text-sm text-muted-foreground">Matrícula {selected.enrollment} · Turma {selected.classroom}</p>{!selected.user_id && <div className="mt-5 max-w-xl bg-secondary p-4 text-sm"><p className="font-semibold">Código de vinculação</p><p className="mt-1 break-all font-mono text-xs">{selected.claim_code}</p><p className="mt-2 text-muted-foreground">Compartilhe somente com este aluno, junto da matrícula.</p></div>}
        <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const field = form.elements.namedItem("attendance"); if (field instanceof HTMLInputElement) void updateAttendance(selected, field.value); }} className="mt-7 flex max-w-sm items-end gap-3"><label className="flex-1 text-sm font-medium">Frequência (%)<Input name="attendance" type="number" min="0" max="100" step="0.01" defaultValue={selected.attendance ?? ""} key={`${selected.id}-${selected.attendance}`} className="mt-2" required /></label><Button type="submit" variant="outline">Salvar</Button></form>
        <h3 className="mt-10 text-lg font-semibold">Lançar nota</h3><form onSubmit={saveGrade} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm font-medium">Disciplina<Input className="mt-2" required value={subject} onChange={e => setSubject(e.target.value)} /></label><label className="text-sm font-medium">Bimestre<select className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={period} onChange={e => setPeriod(e.target.value)}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}º bimestre</option>)}</select></label><label className="text-sm font-medium">Nota (0 a 10)<Input className="mt-2" type="number" min="0" max="10" step="0.01" required value={score} onChange={e => setScore(e.target.value)} /></label><label className="text-sm font-medium">Faltas<Input className="mt-2" type="number" min="0" step="1" required value={absences} onChange={e => setAbsences(e.target.value)} /></label><div className="flex items-end"><Button className="w-full" disabled={busy} type="submit">Salvar nota</Button></div></form><p className="mt-2 text-xs text-muted-foreground">Lançar novamente a mesma disciplina e bimestre atualiza a nota.</p>
        {grades.isPending ? <p className="mt-6 text-muted-foreground">Carregando notas…</p> : grades.error ? <p role="alert" className="mt-6 text-destructive">{errorText(grades.error)}</p> : grades.data?.length ? <div className="mt-7 overflow-x-auto border-t border-border"><table className="w-full min-w-[450px] text-left text-sm"><thead className="bg-secondary"><tr><th className="p-4">Disciplina</th><th className="p-4">Bimestre</th><th className="p-4">Nota</th><th className="p-4">Faltas</th></tr></thead><tbody>{grades.data.map(g => <tr key={g.id} className="border-b border-border"><td className="p-4">{g.subject}</td><td className="p-4">{g.period}º</td><td className="p-4">{formatScore(g.score)}</td><td className="p-4">{g.absences}</td></tr>)}</tbody></table></div> : <p className="mt-6 text-sm text-muted-foreground">Nenhuma nota lançada ainda.</p>}</section>}
      {message && <p role="status" className="mt-6 text-sm">{message}</p>}
    </>}
  </AcademicShell>;
}
