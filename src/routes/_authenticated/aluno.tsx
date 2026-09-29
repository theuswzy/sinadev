import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, BookOpen, CalendarDays, CircleAlert, TrendingUp } from "lucide-react";
import { AcademicShell } from "@/components/academic-shell";
import { supabase } from "@/integrations/supabase/client";
import { errorText, formatScore, getRole, loadGrades, loadMyStudent } from "@/lib/sina-data";

export const Route = createFileRoute("/_authenticated/aluno")({
  head: () => ({
    meta: [
      { title: "Dashboard do aluno — SINA" },
      { name: "description", content: "Acompanhe seu desempenho acadêmico no SINA." },
    ],
  }),
  component: StudentArea,
});

function StudentArea() {
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });
  const student = useQuery({
    queryKey: ["my-student"],
    queryFn: loadMyStudent,
    enabled: role.data === "student",
  });
  const grades = useQuery({
    queryKey: ["my-grades", student.data?.id],
    queryFn: () => loadGrades(student.data?.id ?? ""),
    enabled: !!student.data?.id,
  });

  const average = grades.data?.length
    ? grades.data.reduce((sum, grade) => sum + grade.score, 0) / grades.data.length
    : 0;
  const totalAbsences = grades.data?.reduce((sum, grade) => sum + grade.absences, 0) ?? 0;
  const completed = grades.data?.filter((grade) => grade.score >= 7).length ?? 0;
  const linked = Boolean(student.data?.teacher_id && student.data?.enrollment && student.data?.classroom);

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
            <h2 className="font-display text-3xl font-bold">{student.data.full_name}</h2>
            <p className="mt-2 text-sm text-brand-muted">
              {linked ? `Turma ${student.data.classroom} · Matrícula ${student.data.enrollment}` : "Cadastro concluído · aguardando vínculo acadêmico"}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-border bg-brand-panel px-4 py-3 text-sm">
            <p className="text-xs text-brand-muted">Situação</p>
            <p className="mt-1 font-semibold">{linked ? "Vinculado à turma" : "Aguardando professor"}</p>
          </div>
        </div>
      </section>

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
              ["Média geral", average ? formatScore(average) : "—", "Escala de 0 a 10", TrendingUp],
              ["Frequência", student.data.attendance === null ? "—" : `${formatScore(student.data.attendance)}%`, "Frequência registrada", CalendarDays],
              ["Notas lançadas", String(grades.data?.length ?? 0), "Registros acadêmicos", BookOpen],
              ["Desempenho ≥ 7", String(completed), "Notas com resultado satisfatório", GraduationCap],
            ].map(([label, value, note, Icon]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <Icon className="size-5 text-primary" />
                <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">{String(label)}</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{String(value)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{String(note)}</p>
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
            <div className="border-b border-border p-6"><h2 className="text-lg font-semibold">Disciplinas e notas</h2><p className="mt-1 text-xs text-muted-foreground">Dados vinculados à sua matrícula.</p></div>
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
