import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, BookOpen, CalendarDays, CircleAlert, TrendingUp, Camera, UserRound, Save, X } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadMyStudent } from "@/lib/sina-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, type ChangeEvent } from "react";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Dashboard do aluno — SINA" },
      { name: "description", content: "Acompanhe seu desempenho acadêmico no SINA." },
      { property: "og:title", content: "Dashboard do aluno — SINA" },
      { property: "og:description", content: "Acompanhe seu desempenho acadêmico no SINA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentArea,
});

function StudentArea() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({
    queryKey: ["my-student"],
    queryFn: loadMyStudent,
    enabled: role.data === "student",
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const queryClient = useQueryClient();
  const grades = useQuery({
    queryKey: ["my-grades", student.data?.id],
    queryFn: () => loadGrades(student.data?.id ?? ""),
    enabled: !!student.data?.id,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const average = grades.data?.length
    ? grades.data.reduce((sum, grade) => sum + grade.score, 0) / grades.data.length
    : 0;
  const totalAbsences = grades.data?.reduce((sum, grade) => sum + grade.absences, 0) ?? 0;
  const completed = grades.data?.filter((grade) => grade.score >= 7).length ?? 0;
  const linked = Boolean(student.data?.teacher_id && student.data?.enrollment && student.data?.classroom);

  function openProfile() {
    setProfileName(student.data?.full_name ?? "");
    setProfileAvatar(student.data?.avatar_url ?? null);
    setProfileMessage(null);
    setProfileOpen(true);
  }

  function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setProfileMessage("Escolha uma foto de até 1,5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileAvatar(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!profileName.trim()) {
      setProfileMessage("Informe seu nome.");
      return;
    }
    setProfileSaving(true);
    setProfileMessage(null);
    const { data, error } = await supabase.rpc("student_update_profile", {
      _full_name: profileName.trim(),
      _avatar_url: profileAvatar,
    });
    if (error) {
      setProfileMessage(error.message);
    } else {
      queryClient.setQueryData(["my-student"], data);
      setProfileOpen(false);
    }
    setProfileSaving(false);
  }

  if (role.isPending || student.isPending) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento"><p className="mt-8 text-muted-foreground">Carregando seus dados…</p></AcademicShell>;
  }

  if (role.error || student.error) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento"><p role="alert" className="mt-8 text-destructive">{errorText(role.error ?? student.error)}</p></AcademicShell>;
  }

  if (role.data === "teacher") {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Área do professor"><p className="mt-8">Sua conta possui acesso de professor. <Link to="/professor" className="text-primary underline">Abrir área do professor</Link>.</p></AcademicShell>;
  }

  if (!student.data) {
    return <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento"><div className="mt-8 rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Seu perfil acadêmico está sendo preparado</h2><p className="mt-2 text-sm text-muted-foreground">Entre novamente para criar seu perfil de aluno.</p></div></AcademicShell>;
  }

  return (
    <AcademicShell title="Dashboard acadêmico" subtitle="Meu acompanhamento">
      <section className="mt-8 overflow-hidden rounded-3xl border border-brand-border bg-brand p-6 text-brand-foreground shadow-sm md:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Resumo acadêmico</p>
        <div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-4">
  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-panel">
    {student.data.avatar_url ? <img src={student.data.avatar_url} alt="" className="size-full object-cover" /> : <UserRound className="size-7 text-brand-muted" />}
  </div>
  <div>
    <h2 className="font-display text-3xl font-bold">{student.data.full_name}</h2>
    <p className="mt-1 text-xs text-brand-muted">Perfil do estudante</p>
  </div>
</div>
            <p className="mt-2 text-sm text-brand-muted">
              {linked ? `Turma ${student.data.classroom} · Matrícula ${student.data.enrollment}` : "Cadastro concluído · aguardando vínculo acadêmico"}
            </p>
            <p className="mt-2 text-xs text-brand-muted">Os dados acadêmicos são atualizados automaticamente conforme forem lançados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={openProfile} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground"><UserRound /> Editar perfil</Button>
          <div className="rounded-2xl border border-brand-border bg-brand-panel px-4 py-3 text-sm">
            <p className="text-xs text-brand-muted">Situação</p>
            <p className="mt-1 font-semibold">{linked ? "Vinculado à turma" : "Aguardando professor"}</p>
          </div>
          </div>
        </div>
      </section>

      {profileOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Editar perfil"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Editar perfil</h2><p className="mt-1 text-sm text-muted-foreground">Atualize seu nome e sua foto.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setProfileOpen(false)}><X /></Button></div><div className="mt-6 flex flex-col items-center"><div className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">{profileAvatar ? <img src={profileAvatar} alt="Prévia do perfil" className="size-full object-cover" /> : <UserRound className="size-10 text-muted-foreground" />}<label className="absolute bottom-1 right-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Camera className="size-4" /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatar} /></label></div></div><div className="mt-6"><label className="text-sm font-medium" htmlFor="student-name">Nome completo</label><Input id="student-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-2" /></div>{profileMessage && <p className="mt-3 text-sm text-destructive">{profileMessage}</p>}<div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Cancelar</Button><Button type="button" onClick={() => void saveProfile()} disabled={profileSaving}><Save />{profileSaving ? "Salvando…" : "Salvar alterações"}</Button></div></div></div>}

      {!linked ? (
        <section className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex gap-4">
            <CircleAlert className="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">Sua conta está pronta</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Agora o professor ou responsável autorizado precisa vincular você a uma turma e informar sua matrícula. Depois disso, seu dashboard exibirá os dados acadêmicos.</p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Indicadores acadêmicos" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Média geral", value: average ? formatScore(average) : "—", note: "Escala de 0 a 10", Icon: TrendingUp },
              { label: "Frequência", value: student.data.attendance === null ? "—" : `${formatScore(student.data.attendance)}%`, note: "Frequência registrada", Icon: CalendarDays },
              { label: "Notas lançadas", value: String(grades.data?.length ?? 0), note: "Registros acadêmicos", Icon: BookOpen },
              { label: "Desempenho ≥ 7", value: String(completed), note: "Notas com resultado satisfatório", Icon: GraduationCap },
            ].map(({ label, value, note, Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <Icon className="size-5 text-primary" />
                <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">{label}</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </section>

          <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-lg font-semibold">Desempenho acadêmico</h2><p className="mt-1 text-xs text-muted-foreground">Acompanhe suas notas e frequência lançadas pelos professores.</p></div>
              <div className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:block">SINA</div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl bg-secondary/50 p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">Média atual</p>
                <p className="mt-2 font-display text-4xl font-semibold">{average ? formatScore(average) : "—"}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, average * 10)}%` }} /></div>
              </div>
              <div className="rounded-2xl bg-secondary/50 p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">Frequência</p>
                <p className="mt-2 font-display text-4xl font-semibold">{student.data.attendance === null ? "—" : `${formatScore(student.data.attendance)}%`}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, student.data.attendance ?? 0)}%` }} /></div>
              </div>
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6"><h2 className="text-lg font-semibold">Disciplinas e notas</h2><p className="mt-1 text-xs text-muted-foreground">{linked ? "Dados vinculados à sua matrícula." : "As notas aparecerão aqui quando forem lançadas pelo professor."}</p></div>
            {grades.isPending ? <p className="p-6 text-sm text-muted-foreground">Carregando notas…</p> : grades.error ? <p role="alert" className="p-6 text-sm text-destructive">{errorText(grades.error)}</p> : grades.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-secondary/50"><tr><th className="p-4">Disciplina</th><th className="p-4">Período</th><th className="p-4">Nota</th><th className="p-4">Faltas</th><th className="p-4">Situação</th></tr></thead><tbody>{grades.data.map(g => <tr key={g.id} className="border-b border-border"><td className="p-4 font-medium">{g.subject}</td><td className="p-4">{g.period}º</td><td className="p-4 font-semibold tabular-nums">{formatScore(g.score)}</td><td className="p-4 tabular-nums">{g.absences}</td><td className="p-4">{g.score >= 7 ? "Concluída" : "Em acompanhamento"}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-muted-foreground">Ainda não há dados acadêmicos lançados.</p>}
          </section>

          <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Próximos passos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-4"><p className="text-xs font-bold uppercase text-primary">1</p><p className="mt-2 text-sm font-semibold">Acompanhe suas notas</p><p className="mt-1 text-xs text-muted-foreground">Consulte os lançamentos feitos pelos professores.</p></div>
              <div className="rounded-xl border border-border p-4"><p className="text-xs font-bold uppercase text-primary">2</p><p className="mt-2 text-sm font-semibold">Monitore sua frequência</p><p className="mt-1 text-xs text-muted-foreground">Confira sua frequência registrada no SINA.</p></div>
              <div className="rounded-xl border border-border p-4"><p className="text-xs font-bold uppercase text-primary">3</p><p className="mt-2 text-sm font-semibold">Mantenha seus dados atualizados</p><p className="mt-1 text-xs text-muted-foreground">Em caso de divergência, procure o responsável acadêmico.</p></div>
            </div>
          </section>
        </>
      )}
    </AcademicShell>
  );
}
