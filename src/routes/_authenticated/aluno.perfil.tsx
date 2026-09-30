import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { AcademicShell } from "@/components/academic-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { errorText, getRole, loadMyStudent } from "@/lib/sina-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/aluno.perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — SINA" },
      { name: "description", content: "Personalize seu perfil e sua experiência no SINA." },
    ],
  }),
  component: StudentProfile,
});

function StudentProfile() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({ queryKey: ["my-student"], queryFn: loadMyStudent, enabled: role.data === "student" });
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [darkPreview, setDarkPreview] = useState(false);

  const currentStudent = student.data;
  const displayName = name || currentStudent?.full_name || "";
  const displayAvatar = avatar ?? currentStudent?.avatar_url ?? null;

  useEffect(() => {
    if (currentStudent) {
      setName(currentStudent.full_name ?? "");
      setAvatar(currentStudent.avatar_url ?? null);
    }
  }, [currentStudent?.id]);

  async function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Escolha uma imagem válida.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setMessage("Escolha uma foto de até 6 MB.");
      return;
    }

    setMessage("Enviando foto…");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sua sessão expirou. Entre novamente.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = auth.user.id + "/avatar-" + Date.now() + "." + extension;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      setMessage("Não foi possível enviar a foto. Tente novamente.");
      return;
    }

    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(publicUrl.publicUrl);
    setMessage(null);
  }

  async function saveProfile() {
    if (!displayName.trim()) {
      setMessage("Informe seu nome.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("student_update_profile", {
      _full_name: displayName.trim(),
      _avatar_url: displayAvatar,
    });

    if (error) {
      setMessage(error.message);
    } else {
      queryClient.setQueryData(["my-student"], data);
      toast.success("Perfil atualizado com sucesso.");
    }
    setSaving(false);
  }

  if (role.isPending || student.isPending) {
    return (
      <AcademicShell title="Meu perfil" subtitle="Personalize sua conta">
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => <div key={item} className="sina-card p-6"><div className="sina-skeleton h-5 w-32" /><div className="sina-skeleton mt-4 h-4 w-full" /><div className="sina-skeleton mt-8 h-12 w-full" /></div>)}
        </div>
      </AcademicShell>
    );
  }

  if (role.error || student.error) {
    return <AcademicShell title="Meu perfil" subtitle="Personalize sua conta"><p role="alert" className="mt-8 text-destructive">{errorText(role.error ?? student.error)}</p></AcademicShell>;
  }

  if (role.data !== "student") {
    return <AcademicShell title="Meu perfil" subtitle="Personalize sua conta"><p className="mt-8">Esta área é exclusiva para alunos.</p></AcademicShell>;
  }

  if (!currentStudent) {
    return <AcademicShell title="Meu perfil" subtitle="Personalize sua conta"><p className="mt-8">Seu perfil acadêmico ainda não foi criado.</p></AcademicShell>;
  }

  return (
    <AcademicShell title="Meu perfil" subtitle="Personalize sua conta">
      <div className="mt-8 flex items-center gap-3">
        <Link to="/aluno" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
      </div>

      <section className="mt-5 overflow-hidden rounded-3xl border border-brand-border bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-panel">
              {displayAvatar ? <img src={displayAvatar} alt="" className="size-full object-cover" /> : <UserRound className="size-8 text-brand-muted" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">Meu perfil</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{displayName}</h2>
              <p className="mt-1 text-sm text-brand-muted">Aluno · {currentStudent.classroom ? `Turma ${currentStudent.classroom}` : "Aguardando vínculo"}</p>
            </div>
          </div>
          <Link to="/aluno" className="rounded-xl border border-brand-border bg-brand-panel px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-panel/80">Ver dashboard</Link>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="sina-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Informações pessoais</h2>
              <p className="mt-1 text-sm text-muted-foreground">Atualize as informações que aparecem no seu perfil.</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><UserRound className="size-5" /></div>
          </div>

          <div className="mt-6 flex flex-col items-center sm:flex-row sm:items-start">
            <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
              {displayAvatar ? <img src={displayAvatar} alt="Prévia do perfil" className="size-full object-cover" /> : <UserRound className="size-10 text-muted-foreground" />}
              <label className="absolute bottom-1 right-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
                <Camera className="size-4" />
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatar} />
              </label>
            </div>
            <div className="mt-5 sm:ml-6 sm:mt-0">
              <p className="font-semibold">Foto de perfil</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Use uma imagem quadrada de até 6 MB. PNG, JPG ou WebP.</p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                <Camera className="size-4" /> Alterar foto
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatar} />
              </label>
            </div>
          </div>

          <div className="mt-7">
            <label className="text-sm font-medium" htmlFor="student-profile-name">Nome completo</label>
            <Input id="student-profile-name" value={displayName} onChange={(event) => setName(event.target.value)} className="mt-2" />
          </div>

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

          {message && <p className="mt-4 text-sm text-destructive">{message}</p>}

          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={() => void saveProfile()} disabled={saving}>
              <Save /> {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </section>

        <div className="space-y-5">
          <section className="sina-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Palette className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Personalização</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ajuste a experiência do SINA ao seu gosto.</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold">Prévia escura</p>
                <p className="mt-1 text-xs text-muted-foreground">Use o controle do topo para aplicar o tema.</p>
              </div>
              <button type="button" aria-label="Prévia de tema escuro" aria-pressed={darkPreview} onClick={() => setDarkPreview(!darkPreview)} className={`relative h-6 w-11 rounded-full transition-colors ${darkPreview ? "bg-primary" : "bg-border"}`}>
                <span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${darkPreview ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">A preferência de tema já pode ser alterada pelo botão de aparência no cabeçalho.</p>
          </section>

          <section className="sina-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldCheck className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">Conta e segurança</h2>
                <p className="mt-1 text-sm text-muted-foreground">Informações de acesso da sua conta.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs text-muted-foreground">Identificação acadêmica</p>
              <p className="mt-1 text-sm font-semibold">Conta de aluno SINA</p>
            </div>
            <div className="mt-3 rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold">Senha</p>
              <p className="mt-1 text-xs text-muted-foreground">A alteração de senha pode ser adicionada nesta área.</p>
            </div>
          </section>
        </div>
      </div>
    </AcademicShell>
  );
}
