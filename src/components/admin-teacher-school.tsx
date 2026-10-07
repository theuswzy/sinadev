import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { School, Users, Save, RefreshCw, Search, UserCheck, UserX, Pencil, Camera, X, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorText, loadAdminLinkableInstitutions, loadAdminTeacherSchoolLinks, adminLinkTeacherToInstitution, adminUpdateProfile } from "@/lib/sina-data";

export function AdminTeacherSchool() {
  const qc = useQueryClient();
  const teachers = useQuery({ queryKey: ["admin-teacher-school-links"], queryFn: loadAdminTeacherSchoolLinks });
  const institutions = useQuery({ queryKey: ["admin-linkable-institutions"], queryFn: loadAdminLinkableInstitutions });
  const [selectedSchool, setSelectedSchool] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return teachers.data ?? [];
    return (teachers.data ?? []).filter(teacher =>
      [teacher.display_name, teacher.email, teacher.institution_name ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [teachers.data, search]);

  const linkedCount = (teachers.data ?? []).filter(teacher => !!teacher.institution_id).length;
  const unlinkedCount = Math.max(0, (teachers.data ?? []).length - linkedCount);

  function openProfile(teacher: any) {
    setEditingTeacher(teacher);
    setEditName(teacher.display_name || teacher.email);
    setEditAvatar(teacher.avatar_url ?? null);
    setEditPreview(teacher.avatar_url ?? null);
    setEditAvatarFile(null);
  }

  function closeProfile() {
    setEditingTeacher(null);
    setEditName("");
    setEditAvatar(null);
    setEditPreview(null);
    setEditAvatarFile(null);
  }

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Escolha uma imagem PNG, JPG ou WebP.");
    if (file.size > 6 * 1024 * 1024) return toast.error("A foto precisa ter no máximo 6 MB.");
    setEditAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!editingTeacher || !editName.trim()) return;
    setSavingProfile(true);
    try {
      let avatarUrl = editAvatar;
      if (editAvatarFile) {
        const extension = editAvatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `admin/teachers/${editingTeacher.user_id}/${Date.now()}.${extension}`;
        const { error } = await (await import("@/integrations/supabase/client")).supabase.storage.from("avatars").upload(path, editAvatarFile, { cacheControl: "3600", contentType: editAvatarFile.type, upsert: false });
        if (error) throw error;
        avatarUrl = (await import("@/integrations/supabase/client")).supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      await adminUpdateProfile(editingTeacher.user_id, editName.trim(), avatarUrl);
      await teachers.refetch();
      closeProfile();
      toast.success("Perfil do professor atualizado.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSavingProfile(false);
    }
  }

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
        <div className="flex flex-1 items-start gap-3">
          <School className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="font-semibold">Vincular professores às escolas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Associe cada professor cadastrado a uma escola. O vínculo fica salvo no Supabase e passa a definir o contexto institucional do professor.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([teachers.refetch(), institutions.refetch()])} disabled={teachers.isFetching || institutions.isFetching}>
          <RefreshCw className={"mr-2 size-4 " + ((teachers.isFetching || institutions.isFetching) ? "animate-spin" : "")} />
          {teachers.isFetching || institutions.isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {!teachers.isPending && !teachers.error && !institutions.isPending && !institutions.error && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Professores</p><Users className="size-4 text-primary" /></div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{teachers.data?.length ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">Contas disponíveis para gestão.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Com escola</p><UserCheck className="size-4 text-primary" /></div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{linkedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Contexto institucional definido.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sem escola</p><UserX className="size-4 text-amber-600 dark:text-amber-400" /></div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{unlinkedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Precisam de vínculo antes de operar.</p>
            </div>
          </div>
          <div className="relative mt-5">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou escola" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring" aria-label="Buscar professor" />
          </div>
        </>
      )}

      {teachers.isPending || institutions.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Carregando professores e escolas…</p>
      ) : teachers.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(teachers.error)}</p>
      ) : institutions.error ? (
        <p className="mt-5 text-sm text-destructive">{errorText(institutions.error)}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredTeachers.map(teacher => {
            const value = selectedSchool[teacher.user_id] ?? teacher.institution_id ?? "";
            const sameSchool = value === teacher.institution_id;
            return (
              <div key={teacher.user_id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      {teacher.avatar_url ? <img src={teacher.avatar_url} alt="" className="size-10 rounded-full border border-border object-cover" /> : <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></div>}
                      <div><p className="font-medium">{teacher.display_name || teacher.email}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{teacher.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{teacher.institution_name ? "Escola atual: " + teacher.institution_name : "Sem escola vinculada"}{teacher.school_count > 1 ? " · " + teacher.school_count + " escolas vinculadas" : ""}</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => openProfile(teacher)}>
                      <Pencil className="mr-2 size-4" /> Editar perfil
                    </Button>
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
          {!filteredTeachers.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{teachers.data?.length ? "Nenhum professor corresponde à busca." : "Nenhum professor cadastrado."}</p>}
        </div>
      <Dialog open={!!editingTeacher} onOpenChange={(open) => { if (!open) closeProfile(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar perfil do professor</DialogTitle><DialogDescription>Altere o nome e a foto do perfil do professor.</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {editPreview ? <img src={editPreview} alt="Prévia" className="size-28 rounded-full border border-border object-cover" /> : <div className="flex size-28 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-10" /></div>}
                <label className="absolute bottom-0 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground"><Camera className="size-4" /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => chooseAvatar(e.target.files?.[0])} /></label>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-sm font-semibold text-primary">Alterar foto<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => chooseAvatar(e.target.files?.[0])} /></label>
                {editPreview && <Button type="button" size="sm" variant="ghost" onClick={() => { setEditAvatar(null); setEditPreview(null); setEditAvatarFile(null); }}><X className="mr-1 size-4" />Remover</Button>}
              </div>
            </div>
            <label className="text-sm font-medium">Nome completo<Input className="mt-2" value={editName} onChange={e => setEditName(e.target.value)} /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeProfile} disabled={savingProfile}>Cancelar</Button><Button onClick={() => void saveProfile()} disabled={savingProfile || !editName.trim()}>{savingProfile ? "Salvando…" : "Salvar alterações"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      )}
    </section>
  );
}
