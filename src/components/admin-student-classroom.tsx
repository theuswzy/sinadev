import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserCheck, Users, UserX, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  errorText,
  loadAdminAcademicSetup,
  loadAdminStudentsPage,
  adminAssignStudentToClassroom,
  adminRemoveStudentFromClassroom,
  loadAdminStudentSchoolLinks,
  loadAdminLinkableInstitutions,
  adminLinkStudentToInstitution,
} from "@/lib/sina-data";

export function AdminStudentClassroom() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const students = useQuery({
    queryKey: ["admin-students", debouncedSearch, page],
    queryFn: () => loadAdminStudentsPage(debouncedSearch, onlyWithoutClass, page, pageSize),
    placeholderData: previous => previous,
  });
  const schoolLinks = useQuery({ queryKey: ["admin-student-school-links"], queryFn: loadAdminStudentSchoolLinks });
  const institutions = useQuery({ queryKey: ["admin-linkable-institutions"], queryFn: loadAdminLinkableInstitutions });
  const setup = useQuery({ queryKey: ["admin-academic-setup"], queryFn: loadAdminAcademicSetup });

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [enrollments, setEnrollments] = useState<Record<string, string>>({});
  const [selectedSchool, setSelectedSchool] = useState<Record<string, string>>({});
  const [onlyWithoutClass, setOnlyWithoutClass] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [onlyWithoutClass]);
  const [onlyWithoutSchool, setOnlyWithoutSchool] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const classes = (setup.data?.classrooms ?? []).filter(c => c.status === "active");

  const items = students.data?.items ?? [];
  const total = students.data?.total ?? 0;
  const enrolled = items.filter(s => !!s.classroom_id).length;
  const pendingClass = items.length - enrolled;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const waitingSchool = schoolLinks.data?.filter(s => s.status === "sem_escola").length ?? 0;

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-students"] }),
      qc.invalidateQueries({ queryKey: ["admin-student-school-links"] }),
      qc.invalidateQueries({ queryKey: ["admin-accounts"] }),
    ]);
  }

  async function linkSchool(studentId: string) {
    const institutionId = selectedSchool[studentId];
    if (!institutionId) return;
    setBusy(studentId);
    try {
      await adminLinkStudentToInstitution(studentId, institutionId);
      await refresh();
      toast.success("Aluno vinculado à escola.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
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
            Primeiro vincule o aluno à escola. Depois, defina matrícula e turma. O vínculo escolar determina em qual instituição os dados acadêmicos do aluno ficam registrados.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{total}</p><p className="text-muted-foreground">Alunos</p></div>
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{enrolled}</p><p className="text-muted-foreground">Turmas</p></div>
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{pendingClass}</p><p className="text-muted-foreground">Sem turma</p></div>
          <div className="rounded-xl border border-border px-3 py-2"><p className="font-bold text-lg">{waitingSchool}</p><p className="text-muted-foreground">Sem escola</p></div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <School className="mt-0.5 size-5 text-primary" />
            <div>
              <h3 className="font-semibold">Vincular aluno à escola</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O administrador pode escolher a escola ativa do SINA para cada aluno que ainda não possui vínculo institucional.
              </p>
            </div>
          </div>
          <Button type="button" variant={onlyWithoutSchool ? "default" : "outline"} onClick={() => setOnlyWithoutSchool(v => !v)}>
            {onlyWithoutSchool ? "Mostrando sem escola" : `Aguardando escola: ${waitingSchool}`}
          </Button>
        </div>

        {schoolLinks.isPending || institutions.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando escolas e alunos…</p>
        ) : schoolLinks.error ? (
          <p className="mt-4 text-sm text-destructive">{errorText(schoolLinks.error)}</p>
        ) : institutions.error ? (
          <p className="mt-4 text-sm text-destructive">{errorText(institutions.error)}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {(schoolLinks.data ?? [])
              .filter(student => !onlyWithoutSchool || student.status === "sem_escola")
              .map(student => (
                <div key={student.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{student.full_name}</p>
                        {student.status === "sem_escola" ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Sem escola</span>
                        ) : (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Vinculado</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {student.enrollment || "Sem matrícula"} · {student.institution_name || "Nenhuma escola vinculada"}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                      <select
                        value={selectedSchool[student.id] ?? student.institution_id ?? ""}
                        onChange={e => setSelectedSchool(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm"
                        aria-label={`Escola de ${student.full_name}`}
                      >
                        <option value="">Selecione a escola</option>
                        {(institutions.data ?? []).map(institution => (
                          <option key={institution.id} value={institution.id}>{institution.name}</option>
                        ))}
                      </select>
                      <Button
                        onClick={() => void linkSchool(student.id)}
                        disabled={busy === student.id || !selectedSchool[student.id] || selectedSchool[student.id] === student.institution_id}
                      >
                        {busy === student.id ? "Salvando…" : student.institution_id ? (selectedSchool[student.id] !== student.institution_id ? "Salvar alteração" : "Escola vinculada") : "Salvar vínculo"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

            {!schoolLinks.data?.filter(student => !onlyWithoutSchool || student.status === "sem_escola").length && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Não há alunos aguardando vínculo com uma escola.
              </p>
            )}
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aluno, matrícula ou turma" className="pl-9" />
        </div>
        <Button type="button" variant={onlyWithoutClass ? "default" : "outline"} onClick={() => setOnlyWithoutClass(v => !v)}>
          {onlyWithoutClass ? "Mostrando sem turma" : "Somente sem turma"}
        </Button>
      </div>

      {students.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Carregando usuários matriculados…</p>
      ) : students.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(students.error)}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(student => (
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
          {!items.length && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {total ? "Nenhum aluno corresponde ao filtro nesta página." : "Nenhum perfil de aluno aprovado nesta instituição ainda."}
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {total} aluno(s) encontrados</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || students.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || students.isFetching} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>Próxima</Button>
          </div>
        </div>
      )}
    </section>
  );
}
