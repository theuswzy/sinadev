import { useState } from "react";
import { BookOpen, CalendarRange, Layers3, Save, Archive, Users, FileUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminArchiveClassroom,
  adminUpsertClassroom,
  adminUpsertSubject,
  adminUpsertTerm,
  errorText,
  loadAdminAcademicSetup,
  loadAdminInstitutionTeachers,
  loadAdminTeacherAssignments,
  adminAssignTeacherToClassroom,
  adminUnassignTeacherFromClassroom,
  adminImportAcademicCsv,
} from "@/lib/sina-data";



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
  const lines = text.replace(/^\uFEFF/, "").split(/\r?
/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
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
  const [classroomName, setClassroomName] = useState("");
  const [classroomCode, setClassroomCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termCurrent, setTermCurrent] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [teacherClassroomId, setTeacherClassroomId] = useState("");
  const [importing, setImporting] = useState(false);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-academic-setup"] }),
      qc.invalidateQueries({ queryKey: ["admin-teacher-classroom-assignments"] }),
      qc.invalidateQueries({ queryKey: ["admin-institution-teachers"] }),
    ]);
  }
  async function assignTeacher() {
    if (!teacherId || !teacherClassroomId) return;
    try { await adminAssignTeacherToClassroom(teacherId, teacherClassroomId); setTeacherId(""); setTeacherClassroomId(""); await refresh(); toast.success("Professor vinculado à turma."); }
    catch (error) { toast.error(errorText(error)); }
  }
  async function unassignTeacher(teacher: string, classroom: string) {
    try { await adminUnassignTeacherFromClassroom(teacher, classroom); await refresh(); toast.success("Professor desvinculado da turma."); }
    catch (error) { toast.error(errorText(error)); }
  }

  async function saveClassroom() {
    try { await adminUpsertClassroom(null, classroomName.trim(), classroomCode.trim()); setClassroomName(""); setClassroomCode(""); await refresh(); toast.success("Turma criada."); }
    catch (error) { toast.error(errorText(error)); }
  }
  async function archiveClassroom(id: string) {
    try { await adminArchiveClassroom(id); await refresh(); toast.success("Turma arquivada."); }
    catch (error) { toast.error(errorText(error)); }
  }
  async function saveSubject() {
    try { await adminUpsertSubject(null, subjectName.trim(), subjectCode.trim()); setSubjectName(""); setSubjectCode(""); await refresh(); toast.success("Disciplina criada."); }
    catch (error) { toast.error(errorText(error)); }
  }
  async function saveTerm() {
    try { await adminUpsertTerm(null, termName.trim(), termStart || null, termEnd || null, termCurrent); setTermName(""); setTermStart(""); setTermEnd(""); await refresh(); toast.success("Período acadêmico salvo."); }
    catch (error) { toast.error(errorText(error)); }
  }

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
            <div className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><Layers3 className="size-4 text-primary" /><p className="font-semibold">Turmas</p></div><div className="mt-4 space-y-2"><Input placeholder="Nome da turma" value={classroomName} onChange={e => setClassroomName(e.target.value)} /><Input placeholder="Código (opcional)" value={classroomCode} onChange={e => setClassroomCode(e.target.value)} /><Button onClick={() => void saveClassroom()} disabled={!classroomName.trim()}><Save className="mr-2 size-4" />Criar turma</Button></div><div className="mt-4 space-y-2">{setup.data?.classrooms.map(c => <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 p-3 text-sm"><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.code || "Sem código"} · {c.status === "active" ? "Ativa" : "Arquivada"}</p></div>{c.status === "active" && <Button size="sm" variant="ghost" onClick={() => void archiveClassroom(c.id)} aria-label={`Arquivar ${c.name}`}><Archive className="size-4" /></Button>}</div>)}</div></div>

            <div className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><BookOpen className="size-4 text-primary" /><p className="font-semibold">Disciplinas</p></div><div className="mt-4 space-y-2"><Input placeholder="Nome da disciplina" value={subjectName} onChange={e => setSubjectName(e.target.value)} /><Input placeholder="Código (opcional)" value={subjectCode} onChange={e => setSubjectCode(e.target.value)} /><Button onClick={() => void saveSubject()} disabled={!subjectName.trim()}><Save className="mr-2 size-4" />Criar disciplina</Button></div><div className="mt-4 space-y-2">{setup.data?.subjects.map(s => <div key={s.id} className="rounded-xl bg-secondary/50 p-3 text-sm"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.code || "Sem código"} · {s.status === "active" ? "Ativa" : "Inativa"}</p></div>)}</div></div>

            <div className="rounded-2xl border border-border p-4"><div className="flex items-center gap-2"><CalendarRange className="size-4 text-primary" /><p className="font-semibold">Períodos</p></div><div className="mt-4 space-y-2"><Input placeholder="Ex.: 1º Bimestre" value={termName} onChange={e => setTermName(e.target.value)} /><div className="grid grid-cols-2 gap-2"><Input type="date" value={termStart} onChange={e => setTermStart(e.target.value)} /><Input type="date" value={termEnd} onChange={e => setTermEnd(e.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={termCurrent} onChange={e => setTermCurrent(e.target.checked)} /> Marcar como período atual</label><Button onClick={() => void saveTerm()} disabled={!termName.trim()}><Save className="mr-2 size-4" />Criar período</Button></div><div className="mt-4 space-y-2">{setup.data?.terms.map(t => <div key={t.id} className="rounded-xl bg-secondary/50 p-3 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-medium">{t.name}</p>{t.is_current && <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Atual</span>}</div><p className="text-xs text-muted-foreground">{t.starts_at || "Sem início"} · {t.ends_at || "Sem fim"}</p></div>)}</div></div>
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
              <Button onClick={() => void assignTeacher()} disabled={!teacherId || !teacherClassroomId}>Vincular</Button>
            </div>
            <div className="mt-4 space-y-2">
              {(assignments.data ?? []).map(a => <div key={a.classroom_id + a.teacher_id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3 text-sm"><div><p className="font-medium">{a.teacher_name || a.teacher_email}</p><p className="text-xs text-muted-foreground">{a.classroom_name}</p></div><Button size="sm" variant="ghost" onClick={() => void unassignTeacher(a.teacher_id, a.classroom_id)}>Remover</Button></div>)}
              {!assignments.isPending && !assignments.data?.length && <p className="text-sm text-muted-foreground">Nenhum professor vinculado a uma turma ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
