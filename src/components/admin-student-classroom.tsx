import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserCheck, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  errorText,
  loadAdminAcademicSetup,
  loadAdminStudents,
  adminAssignStudentToClassroom,
  adminRemoveStudentFromClassroom,
} from "@/lib/sina-data";

export function AdminStudentClassroom() {
  const qc = useQueryClient();
  const students = useQuery({ queryKey: ["admin-students"], queryFn: loadAdminStudents });
  const setup = useQuery({ queryKey: ["admin-academic-setup"], queryFn: loadAdminAcademicSetup });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [enrollments, setEnrollments] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyWithoutClass, setOnlyWithoutClass] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const classes = (setup.data?.classrooms ?? []).filter(c => c.status === "active");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students.data ?? []).filter(student => {
      const matchesSearch = !term || `${student.full_name} ${student.email ?? ""} ${student.enrollment ?? ""} ${student.classroom_name ?? ""}`.toLowerCase().includes(term);
      const matchesClass = !onlyWithoutClass || !student.classroom_id;
      return matchesSearch && matchesClass;
    });
  }, [students.data, search, onlyWithoutClass]);

  const total = students.data?.length ?? 0;
  const enrolled = students.data?.filter(s => !!s.classroom_id).length ?? 0;
  const pendingClass = total - enrolled;

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-students"] }),
      qc.invalidateQueries({ queryKey: ["admin-accounts"] }),
    ]);
  }

  async function assign(id: string) {
    const classroomId = selected[id];
    if (!classroomId) return;
    setBusy(id);
    try {
      await adminAssignStudentToClassroom(id, classroomId, enrollments[id] ?? "");
      await refresh();
      toast.success("Aluno matriculado na turma.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await adminRemoveStudentFromClassroom(id);
      await refresh();
      toast.success("Aluno retirado da turma.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sina-card sina-card-hover p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h2 className="font-semibold">Usuários matriculados</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Gerencie os alunos aprovados da instituição, defina matrícula e vincule cada um à turma correta.
            O vínculo feito aqui libera o aluno para o professor trabalhar com notas, frequência, avaliações e atividades.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{total}</p><p className="text-muted-foreground">Alunos</p></div>
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{enrolled}</p><p className="text-muted-foreground">Matriculados</p></div>
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{pendingClass}</p><p className="text-muted-foreground">Sem turma</p></div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno, e-mail, matrícula ou turma" className="pl-9" />
        </div>
        <Button
          type="button"
          variant={onlyWithoutClass ? "default" : "outline"}
          onClick={() => setOnlyWithoutClass(v => !v)}
        >
          {onlyWithoutClass ? "Mostrando sem turma" : "Somente sem turma"}
        </Button>
      </div>

      {students.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Carregando usuários matriculados…</p>
      ) : students.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(students.error)}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {filtered.map(student => (
            <div key={student.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{student.full_name}</p>
                    {student.classroom_id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                        <UserCheck className="size-3" /> Matriculado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <UserX className="size-3" /> Sem turma
                      </span>
                    )}
                  </div>
                  <p className="break-all text-xs text-muted-foreground">
                    {student.enrollment || "Sem matrícula"} · {student.classroom_name || "Sem turma"}
                  </p>
                </div>
                {student.classroom_id && (
                  <Button size="sm" variant="ghost" onClick={() => void remove(student.id)} disabled={busy === student.id}>
                    Retirar da turma
                  </Button>
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]">
                <select
                  value={selected[student.id] ?? student.classroom_id ?? ""}
                  onChange={e => setSelected(v => ({ ...v, [student.id]: e.target.value }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label={`Turma de ${student.full_name}`}
                >
                  <option value="">Selecione uma turma</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input
                  value={enrollments[student.id] ?? student.enrollment ?? ""}
                  onChange={e => setEnrollments(v => ({ ...v, [student.id]: e.target.value }))}
                  placeholder="Matrícula"
                />
                <Button onClick={() => void assign(student.id)} disabled={busy === student.id || !selected[student.id]}>
                  {busy === student.id ? "Salvando…" : student.classroom_id ? "Trocar turma" : "Matricular"}
                </Button>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {students.data?.length ? "Nenhum aluno corresponde ao filtro." : "Nenhum perfil de aluno aprovado nesta instituição ainda."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
