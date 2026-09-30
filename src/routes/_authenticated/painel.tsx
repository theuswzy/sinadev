import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { GraduationCap, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/sina-data";
import {
  alunos as todosAlunos,
  bimestresTurma,
  media,
  rotuloSituacao,
  situacaoDe,
  type Aluno,
  type Situacao,
} from "@/lib/academic-data";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "SINA — Acompanhamento Acadêmico PROSUB" },
      { name: "description", content: "Sistema Digital para Acompanhamento de Dados Acadêmicos de Alunos do PROSUB. Consulte indicadores, boletins e desempenho por bimestre." },
      { property: "og:title", content: "SINA — Acompanhamento Acadêmico PROSUB" },
      { property: "og:description", content: "Indicadores acadêmicos, evolução por bimestre e boletins individuais dos alunos do PROSUB." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const n1 = (v: number) => v.toFixed(1).replace(".", ",");

const corSituacao: Record<Situacao, string> = {
  aprovado: "bg-success/12 text-success ring-success/25",
  recuperacao: "bg-warning/12 text-warning ring-warning/25",
  reprovado: "bg-destructive/12 text-destructive ring-destructive/25",
};

function Selo({ s }: { s: Situacao }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ring-1 ${corSituacao[s]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {rotuloSituacao[s]}
    </span>
  );
}

function Indicador({ rotulo, valor, nota, progresso, tom = "primary" }: {
  rotulo: string;
  valor: string;
  nota: string;
  progresso: number;
  tom?: "primary" | "success" | "warning" | "destructive";
}) {
  const barra = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[tom];
  return (
    <div className="rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <p className="text-[11px] font-bold uppercase text-muted-foreground">{rotulo}</p>
      <p className="mt-3 font-display text-3xl font-semibold leading-none tabular-nums">{valor}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barra}`} style={{ width: `${progresso}%` }} />
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function Circuitos() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-28 w-44 text-primary/60" viewBox="0 0 180 115" fill="none">
      <path d="M0 44H22L42 24H136M0 64H33L54 43H154M0 86H17L63 55H110" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="136" cy="24" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="154" cy="43" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="110" cy="55" r="3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Painel() {
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["sina-account"], queryFn: async () => { const { data } = await supabase.auth.getUser(); return data.user ? getRole() : null; } });
  useEffect(() => {
    if (account.data === "student") {
      void navigate({ to: "/aluno", replace: true });
    } else if (account.data === "teacher") {
      void navigate({ to: "/professor", replace: true });
    } else if (account.data === "admin") {
      void navigate({ to: "/admin", replace: true });
    }
  }, [account.data, navigate]);

  const [selecionado, setSelecionado] = useState<Aluno | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Situacao>("todos");
  const alunosValidos = todosAlunos.filter((a) => a && Array.isArray(a.disciplinas) && a.disciplinas.length > 0);
  const alunoSelecionado = selecionado?.disciplinas?.length ? selecionado : null;

  const lista = useMemo(
    () => alunosValidos
      .filter((a) => a.nome.toLowerCase().includes(busca.trim().toLowerCase()))
      .filter((a) => filtro === "todos" || situacaoDe(a) === filtro)
      .sort((a, b) => media(b) - media(a)),
    [alunosValidos, busca, filtro],
  );

  const temDados = alunosValidos.length > 0;
  const mediaGeral = temDados ? alunosValidos.reduce((t, a) => t + media(a), 0) / alunosValidos.length : 0;
  const frequenciaGeral = temDados ? alunosValidos.reduce((t, a) => t + a.frequencia, 0) / alunosValidos.length : 0;
  const emRisco = alunosValidos.filter((a) => situacaoDe(a) !== "aprovado").length;
  const turmas = new Set(alunosValidos.map((a) => a.turma)).size;

  if (account.isPending) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando área acadêmica…</div>;
  }

  if (account.error) {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center"><h1 className="font-semibold">Não foi possível carregar sua área</h1><p className="mt-2 text-sm text-muted-foreground">Sua sessão pode ter expirado. Entre novamente para continuar.</p><Link to="/auth" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Ir para o acesso</Link></div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b border-brand-border bg-brand text-brand-foreground">
        <Circuitos />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5 lg:px-8">
          <Link to="/painel" className="flex min-w-0 items-center gap-4" aria-label="SINA — painel">
            <div className="flex shrink-0 items-center gap-2.5">
              <GraduationCap aria-hidden="true" className="size-10 stroke-[1.4]" />
              <span className="font-display text-3xl font-bold leading-none">SINA</span>
            </div>
            <span className="hidden h-9 w-px bg-brand-border sm:block" />
            <span className="hidden max-w-[278px] text-[11px] font-medium leading-snug text-brand-muted sm:block">
              Sistema Digital para Acompanhamento de Dados Acadêmicos
            </span>
          </Link>
          <nav aria-label="Navegação principal" className="flex w-full items-center gap-6 text-sm font-medium text-brand-muted sm:w-auto lg:gap-8">
            <a className="border-b-2 border-primary pb-1 text-brand-foreground" href="#inicio">Início</a>
            <a className="pb-1 transition-colors hover:text-brand-foreground" href="#desempenho">Desempenho</a>
            <a className="pb-1 transition-colors hover:text-brand-foreground" href="#alunos">Alunos</a>
            <Link to="/" className="pb-1 transition-colors hover:text-brand-foreground">Sobre</Link>
            <Link to="/aluno" className="ml-auto flex items-center gap-2 border-b-2 border-transparent pb-1 text-brand-foreground hover:border-primary sm:ml-0"><UserRound aria-hidden="true" className="size-5" /><span>{account.data ? "Minha área" : "Acesso"}</span></Link>
          </nav>
        </div>
      </header>

      <main id="inicio" className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Acompanhamento acadêmico</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Visão geral da escola</h1>
          </div>
           <p className="text-xs text-muted-foreground">{temDados ? `${alunosValidos.length} alunos · ${turmas} turmas` : "Nenhum dado acadêmico cadastrado"}</p>
        </div>

        <section aria-label="Indicadores acadêmicos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador rotulo="Média geral" valor={temDados ? n1(mediaGeral) : "—"} nota={temDados ? "Escala de 0 a 10" : "Sem dados"} progresso={mediaGeral * 10} />
          <Indicador rotulo="Frequência média" valor={temDados ? `${Math.round(frequenciaGeral)}%` : "—"} nota={temDados ? "Frequência dos alunos" : "Sem dados"} progresso={frequenciaGeral} tom="success" />
           <Indicador rotulo="Alunos em atenção" valor={temDados ? String(emRisco) : "—"} nota={temDados ? "Recuperação ou reprovação" : "Sem dados"} progresso={temDados ? (emRisco / alunosValidos.length) * 100 : 0} tom="destructive" />
          <Indicador rotulo="Turmas monitoradas" valor={temDados ? String(turmas) : "—"} nota={temDados ? "Turmas com alunos" : "Sem dados"} progresso={temDados ? 100 : 0} tom="warning" />
        </section>

        <section id="desempenho" className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col rounded-md border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Desempenho por bimestre</h2>
                <p className="mt-1 text-xs text-muted-foreground">Média da escola em cada período</p>
              </div>
              <div className="flex gap-1.5 pt-1" aria-hidden="true"><span className="size-2 rounded-full bg-primary" /><span className="size-2 rounded-full bg-brand-border" /></div>
            </div>
            {temDados ? <div className="mt-7 flex h-64 items-end gap-3 sm:gap-5">
              {bimestresTurma.map((b) => (
                <div key={b.rotulo} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums">{n1(b.valor)}</span>
                  <div className="flex w-full flex-1 items-end overflow-hidden rounded-t bg-secondary">
                    <div className="w-full rounded-t bg-primary transition-[height] duration-700" style={{ height: `${b.valor * 10}%` }} />
                  </div>
                  <span className="text-center text-[11px] text-muted-foreground">{b.rotulo}</span>
                </div>
              ))}
            </div> : <div className="mt-7 flex h-64 items-center justify-center border-t border-border text-sm text-muted-foreground">Sem dados para exibir o desempenho.</div>}
          </div>

          <aside className="rounded-md border border-brand-border bg-brand-panel p-6 text-brand-foreground">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><span className="size-2 rounded-full bg-primary" />Boletim individual</h2>
               {alunoSelecionado && <Selo s={situacaoDe(alunoSelecionado)} />}
            </div>
             {alunoSelecionado ? <>
             <p className="mt-5 font-display text-xl font-semibold">{alunoSelecionado.nome}</p>
             <p className="mt-1 text-xs text-brand-muted">Turma {alunoSelecionado.turma} · Matrícula {alunoSelecionado.matricula}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 border-y border-brand-border py-4">
               <div><p className="text-xs text-brand-muted">Média</p><p className="mt-1 text-lg font-semibold tabular-nums">{n1(media(alunoSelecionado))}</p></div>
               <div><p className="text-xs text-brand-muted">Frequência</p><p className="mt-1 text-lg font-semibold tabular-nums">{alunoSelecionado.frequencia}%</p></div>
               <div><p className="text-xs text-brand-muted">Faltas</p><p className="mt-1 text-lg font-semibold tabular-nums">{alunoSelecionado.disciplinas.reduce((t, d) => t + d.faltas, 0)}</p></div>
            </div>
            <div className="mt-4 space-y-3">
               {alunoSelecionado.disciplinas.map((d) => {
                const cor = d.nota >= 7 ? "bg-primary" : d.nota >= 5 ? "bg-warning" : "bg-destructive";
                const texto = d.nota >= 7 ? "text-brand-muted" : d.nota >= 5 ? "text-warning" : "text-destructive";
                return (
                  <div key={d.nome}>
                    <div className="flex items-baseline justify-between gap-3 text-sm"><span>{d.nome}</span><span className={`font-semibold tabular-nums ${texto}`}>{n1(d.nota)}</span></div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand-border"><div className={`h-full rounded-full ${cor}`} style={{ width: `${d.nota * 10}%` }} /></div>
                    <p className="mt-1 text-[11px] text-brand-muted">{d.faltas} falta{d.faltas === 1 ? "" : "s"}</p>
                  </div>
                );
              })}
            </div>
            </> : <p className="mt-8 text-sm text-brand-muted">Nenhum boletim disponível.</p>}
          </aside>
        </section>

        <section id="alunos" className="mt-5 overflow-hidden rounded-md border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
            <div><h2 className="text-lg font-semibold">Alunos cadastrados</h2><p className="mt-0.5 text-xs text-muted-foreground">{lista.length} registro{lista.length === 1 ? "" : "s"}{temDados ? " · ordenados por média" : ""}</p></div>
            {temDados && <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <label className="relative w-full sm:w-52">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <span className="sr-only">Buscar aluno</span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40" />
              </label>
              <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1 rounded-md bg-secondary p-1">
                {(["todos", "aprovado", "recuperacao", "reprovado"] as const).map((f) => (
                  <Button key={f} type="button" size="sm" variant={filtro === f ? "default" : "ghost"} aria-pressed={filtro === f} onClick={() => setFiltro(f)} className="h-7 px-2.5 text-xs shadow-none">
                    {f === "todos" ? "Todos" : rotuloSituacao[f]}
                  </Button>
                ))}
              </div>
            </div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-secondary/40"><tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Aluno</th><th className="px-4 py-3 font-semibold">Turma</th><th className="px-4 py-3 text-right font-semibold">Média</th><th className="px-4 py-3 text-right font-semibold">Frequência</th><th className="px-6 py-3 text-right font-semibold">Situação</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {lista.map((a) => (
                  <tr key={a.id} tabIndex={0} role="button" aria-label={`Ver boletim de ${a.nome}`} aria-selected={a.id === selecionado?.id} onClick={() => setSelecionado(a)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelecionado(a); } }} className={`cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-primary ${a.id === selecionado?.id ? "bg-accent/50" : ""}`}>
                    <td className="px-6 py-3.5"><p className="font-semibold">{a.nome}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Mat. {a.matricula}</p></td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{a.turma}</td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{n1(media(a))}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{a.frequencia}%</td>
                    <td className="px-6 py-3.5 text-right"><Selo s={situacaoDe(a)} /></td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">{temDados ? "Nenhum aluno encontrado com esses filtros." : "Nenhum aluno cadastrado."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <footer className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">SINA</footer>
      </main>
    </div>
  );
}
