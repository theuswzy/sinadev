import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, LockKeyhole, Palette, Pencil, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { errorText, getRole, loadMyStudent } from "@/lib/sina-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — SINA" },
      { name: "description", content: "Edite seus dados pessoais e personalize sua experiência no SINA." },
    ],
  }),
  component: StudentProfile,
});

function StudentProfile() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const account = useQuery({
    queryKey: ["auth-user-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(true);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentStudent = student.data;
  const accountName =
    account.data?.user_metadata?.display_name ||
    account.data?.email?.split("@")[0] ||
    "Usuário";
  const roleLabel =
    role.data === "admin" ? "Administrador" :
    role.data === "teacher" ? "Professor" :
    "Aluno";
  const currentName = currentStudent?.full_name || accountName;
  const currentAvatar = currentStudent?.avatar_url ?? account.data?.user_metadata?.avatar_url ?? null;
  const displayName = editing ? name : currentName;
  const displayAvatar = editing ? avatar : currentAvatar;

  useEffect(() => {
    if (!editing) {
      setName(currentName);
      setAvatar(currentAvatar);
      return;
    }

    if (!name && (currentStudent?.id || account.data?.id)) {
      setName(currentName);
      setAvatar(currentAvatar);
    }
  }, [currentStudent?.id, currentStudent?.full_name, currentStudent?.avatar_url, account.data?.id, accountName, editing]);

  function beginEditing() {
    setName(currentName);
    setAvatar(currentAvatar);
    setMessage(null);
    setEditing(true);
  }

  function cancelEditing() {
    setName(currentName);
    setAvatar(currentAvatar);
    setMessage(null);
    setEditing(false);
  }

  async function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Escolha uma imagem PNG, JPG ou WebP.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setMessage("A foto precisa ter no máximo 6 MB.");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sua sessão expirou. Entre novamente.");
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${auth.user.id}/avatar-${Date.now()}.${extension}`;

      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(publicUrl.publicUrl);
      toast.success("Foto carregada. Clique em salvar para concluir.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setMessage("Informe seu nome.");
      return;
    }

    if (trimmedName.length < 2) {
      setMessage("Informe um nome válido.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (role.data === "student") {
        const { error: ensureError } = await supabase.rpc("ensure_student_profile");
        if (ensureError) throw ensureError;

        const { data, error } = await supabase.rpc("student_update_profile", {
          _full_name: trimmedName,
          _avatar_url: avatar,
        });

        if (error) throw error;

        await supabase.auth.updateUser({
          data: { display_name: trimmedName },
        });

        queryClient.setQueryData(["my-student"], data);
        await queryClient.invalidateQueries({ queryKey: ["my-student"] });
        setAvatar(data?.avatar_url ?? avatar);
      } else {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: trimmedName },
        });
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["auth-user-profile"] });
      setEditing(false);
      setName(trimmedName);
      toast.success("Perfil atualizado com sucesso.");
    } catch (error) {
      const text = errorText(error);
      setMessage(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    const email = account.data?.email;
    if (!email) {
      toast.error("Não encontramos o e-mail da sua conta.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Enviamos um link para alterar sua senha.");
  }

  const studentLoading = role.data === "student" && student.isPending;
  const studentError = role.data === "student" ? student.error : null;

  if (role.isPending || studentLoading || account.isPending) {
    return (
      <AcademicShell title="Meu perfil" subtitle="Edite seus dados e personalize sua experiência">
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => (
            <div key={item} className="sina-card p-6">
              <div className="sina-skeleton h-5 w-32" />
              <div className="sina-skeleton mt-4 h-4 w-full" />
              <div className="sina-skeleton mt-8 h-12 w-full" />
            </div>
          ))}
        </div>
      </AcademicShell>
    );
  }

  if (role.error || studentError || account.error) {
    return (
      <AcademicShell title="Meu perfil" subtitle="Edite seus dados e personalize sua experiência">
        <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive" role="alert">
          {errorText(role.error ?? studentError ?? account.error)}
        </div>
      </AcademicShell>
    );
  }

  return (
    <AcademicShell title="Meu perfil" subtitle="Edite seus dados e personalize sua experiência">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link to={role.data === "admin" ? "/admin" : role.data === "teacher" ? "/professor" : "/aluno"} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        {!editing && (
          <Button type="button" onClick={beginEditing}>
            <Pencil /> Editar perfil
          </Button>
        )}
      </div>

      <section className="mt-5 overflow-hidden rounded-3xl border border-brand-border bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-panel">
              {displayAvatar ? <img src={displayAvatar} alt="" className="size-full object-cover" /> : <UserRound className="size-8 text-brand-muted" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Meu perfil</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{currentName}</h2>
              <p className="mt-1 text-sm text-brand-muted">{roleLabel}{currentStudent?.classroom ? ` · Turma ${currentStudent.classroom}` : ""}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-brand-border bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground">{roleLabel}</span>
            {currentStudent && (
              <>
                <span className="rounded-xl border border-brand-border bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground">
                  {currentStudent.enrollment || "Matrícula pendente"}
                </span>
                <span className="rounded-xl border border-brand-border bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground">
                  {currentStudent.classroom || "Turma pendente"}
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="sina-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Editar informações pessoais</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {editing ? "Faça as alterações e clique em salvar." : "Seus dados pessoais estão somente para leitura."}
              </p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <UserRound className="size-5" />
            </div>
          </div>

          <fieldset disabled={!editing || saving || uploading} className="mt-6">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                {displayAvatar ? <img src={displayAvatar} alt="Prévia do perfil" className="size-full object-cover" /> : <UserRound className="size-10 text-muted-foreground" />}
                {role.data === "student" && (
                  <label className="absolute bottom-1 right-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
                    <Camera className="size-4" />
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatar} />
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left">
                <p className="font-semibold">Foto de perfil</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  {role.data === "student" ? "PNG, JPG ou WebP, até 6 MB." : "A foto deste tipo de conta é somente para exibição."}
                </p>
                {role.data === "student" && (
                  <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                    <Camera className="size-4" /> {uploading ? "Enviando…" : "Escolher foto"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatar} />
                  </label>
                )}
              </div>
            </div>

            <div className="mt-7">
              <label className="text-sm font-medium" htmlFor="student-profile-name">Nome completo</label>
              <Input
                id="student-profile-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Digite seu nome completo"
                autoComplete="name"
                className="mt-2 h-11"
              />
            </div>

            {currentStudent && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Matrícula</p>
                  <p className="mt-1 font-semibold">{currentStudent.enrollment || "Ainda não vinculada"}</p>
                </div>
                <div className="rounded-2xl bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Turma</p>
                  <p className="mt-1 font-semibold">{currentStudent.classroom || "Ainda não vinculada"}</p>
                </div>
              </div>
            )}
          </fieldset>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="text-xs text-muted-foreground">E-mail da conta</p>
            <p className="mt-1 font-semibold break-all">{account.data?.email || "Não informado"}</p>
            <p className="mt-1 text-xs text-muted-foreground">O e-mail da conta é exibido aqui, mas a matrícula e a turma são gerenciadas academicamente.</p>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {message}
            </div>
          )}

          {editing ? (
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEditing} disabled={saving || uploading}>
                <X /> Cancelar
              </Button>
              <Button type="button" onClick={() => void saveProfile()} disabled={saving || uploading}>
                <Save /> {saving ? "Salvando…" : "Salvar perfil"}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 text-primary" />
              Perfil salvo. Clique em <button type="button" onClick={beginEditing} className="font-semibold text-primary underline underline-offset-4">Editar perfil</button> para fazer novas alterações.
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="sina-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Palette className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Personalização</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ajuste a aparência da sua experiência no SINA.</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold">Aparência</p>
                <p className="mt-1 text-xs text-muted-foreground">Alterne entre tema claro e escuro.</p>
              </div>
              <ThemeToggle />
            </div>
          </section>

          <section className="sina-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldCheck className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Conta e segurança</h2>
                <p className="mt-1 text-sm text-muted-foreground">Controles da sua conta SINA.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Conta</p>
              <p className="mt-1 text-sm font-semibold break-all">{account.data?.email || "Conta SINA"}</p>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void sendPasswordReset()}>
              <LockKeyhole /> Alterar senha
            </Button>
          </section>
        </div>
      </div>
    </AcademicShell>
  );
}
