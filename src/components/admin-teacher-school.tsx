import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { School, Users, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorText, loadAdminLinkableInstitutions, loadAdminTeacherSchoolLinks, adminLinkTeacherToInstitution } from "@/lib/sina-data";

export function AdminTeacherSchool() {
  const qc = useQueryClient();
  const teachers = useQuery({ queryKey: ["admin-teacher-school-links"], queryFn: loadAdminTeacherSchoolLinks });
  const institutions = useQuery({ queryKey: ["admin-linkable-institutions"], queryFn: loadAdminLinkableInstitutions });
  const [selectedSchool, setSelectedSchool] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function save(teacherId: string) {
    const institutionId = selectedSchool[teacherId];
    if (!institutionId) return;
    setBusy(teacherId);
    try {
      await adminLinkTeacherToInstitution(teacherId, institutionId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-teacher-school-links"] }),
        qc.invalidateQueries({ queryKey: ["admin-accounts"] }),
      ]);
      toast.success("Professor vinculado à escola.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="professores-escolas" className="sina-card sina-card-hover scroll-mt-28 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
        <School className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Vincular professores às escolas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Associe cada professor cadastrado a uma escola. O vínculo fica salvo no Supabase e passa a definir o contexto institucional do professor.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([teachers.refetch(), institutions.refetch()])} disabled={teachers.isFetching || institutions.isFetching}>
          <RefreshCw className={"mr-2 size-4 " + ((teachers.isFetching || institutions.isFetching) ? "animate-spin" : "")} />
          {teachers.isFetching || institutions.isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {teachers.isPending || institutions.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Carregando professores e escolas…</p>
      ) : teachers.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(teachers.error)}</p>
      ) : institutions.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(institutions.error)}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {(teachers.data ?? []).map(teacher => {
            const value = selectedSchool[teacher.user_id] ?? teacher.institution_id ?? "";
            const sameSchool = value === teacher.institution_id;
            return (
              <div key={teacher.user_id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><Users className="size-4 text-primary" /><p className="font-medium">{teacher.display_name || teacher.email}</p></div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{teacher.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{teacher.institution_name ? "Escola atual: " + teacher.institution_name : "Sem escola vinculada"}{teacher.school_count > 1 ? " · " + teacher.school_count + " escolas vinculadas" : ""}</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <select value={value} onChange={e => setSelectedSchool(prev => ({ ...prev, [teacher.user_id]: e.target.value }))} className="h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm" aria-label={"Escola de " + (teacher.display_name || teacher.email)}>
                      <option value="">Selecione a escola</option>
                      {(institutions.data ?? []).map(institution => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                    </select>
                    <Button onClick={() => void save(teacher.user_id)} disabled={busy === teacher.user_id || !value || sameSchool}>
                      <Save className="mr-2 size-4" />{busy === teacher.user_id ? "Salvando…" : sameSchool ? "Vinculado" : "Salvar"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {!teachers.data?.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhum professor cadastrado.</p>}
        </div>
      )}
    </section>
  );
}
