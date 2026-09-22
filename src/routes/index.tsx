import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  alunos as todosAlunos,
  bimestresTurma,
  media,
  rotuloSituacao,
  situacaoDe,
  type Aluno,
  type Situacao,
} from "@/lib/academic-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Acadêmico — Acompanhamento de Dados Escolares" },
      {
        name: "description",
        content:
          "Sistema digital para acompanhar notas, frequência e situação acadêmica de alunos por turma e bimestre.",
      },
      { property: "og:title", content: "Painel Acadêmico — Acompanhamento de Dados Escolares" },
      {
        property: "og:description",
        content:
          "Indicadores de desempenho, lista de alunos e boletim individual em um único painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const n1 = (v: number) => v.toFixed(1).replace(".", ",");

const corSituacao: Record<Situacao, string> = {
  aprovado: "bg-success/12 text-success ring-success/25",
  recuperacao: "bg-warning/15 text-warning ring-warning/30",
  reprovado: "bg-destructive/12 text-destructive ring-destructive/25",
};

function Selo({ s }: { s: Situacao }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${corSituacao[s]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {rotuloSituacao[s]}
    </span>
  );
}

function Indicador({
  rotulo,
  valor,
  nota,
  progresso,
  tom = "primary",
}: {
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
  const texto = tom === "destructive" ? "text-destructive" : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {rotulo}
      </p>
      <p className={`tabular mt-3 text-3xl font-semibold leading-none ${texto}`}>{valor}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barra}`} style={{ width: `${progresso}%` }} />
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function Painel() {
  const [selecionado, setSelecionado] = useState<Aluno>(todosAlunos[2]!);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Situacao>("todos");

  const lista = useMemo(
    () =>
      todosAlunos
        .filter((a) => a.nome.toLowerCase().includes(busca.trim().toLowerCase()))
        .filter((a) => filtro === "todos" || situacaoDe(a) === filtro)
        .sort((a, b) => media(b) - media(a)),
    [busca, filtro],
  );

  const mediaGeral = todosAlunos.reduce((t, a) => t + media(a), 0) / todosAlunos.length;
  const frequenciaGeral = todosAlunos.reduce((t, a) => t + a.frequencia, 0) / todosAlunos.length;
  const emRisco = todosAlunos.filter((a) => situacaoDe(a) !== "aprovado").length;
  const turmas = new Set(todosAlunos.map((a) => a.turma)).size;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-semibold text-primary-foreground">
            A
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold leading-none">Acadêmico</p>
            <p className="tabular mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Escola Municipal Vila Nova
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="tabular rounded-md bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
              Ano letivo 2026
            </span>
            <span className="tabular rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
              4º bimestre
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Acompanhamento de dados acadêmicos
            </p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Visão geral da escola</h1>
          </div>
          <p className="tabular text-xs text-muted-foreground">
            {todosAlunos.length} alunos · {turmas} turmas
          </p>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Média geral"
            valor={n1(mediaGeral)}
            nota="Escala de 0 a 10"
            progresso={mediaGeral * 10}
          />
          <Indicador
            rotulo="Frequência média"
            valor={`${Math.round(frequenciaGeral)}%`}
            nota="Meta institucional: 85%"
            progresso={frequenciaGeral}
            tom="success"
          />
          <Indicador
            rotulo="Alunos em atenção"
            valor={String(emRisco)}
            nota="Recuperação ou reprovação"
            progresso={(emRisco / todosAlunos.length) * 100}
            tom="destructive"
          />
          <Indicador
            rotulo="Turmas monitoradas"
            valor={String(turmas)}
            nota="Todas com dados atualizados"
            progresso={100}
            tom="warning"
          />
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-12">
          <div className="flex flex-col rounded-lg border border-border bg-card p-6 lg:col-span-7">
            <h2 className="text-lg font-semibold">Evolução do desempenho</h2>
            <p className="mt-1 text-xs text-muted-foreground">Média da escola por bimestre</p>
            <div className="mt-6 flex min-h-44 flex-1 items-end gap-4">
              {bimestresTurma.map((b) => (
                <div key={b.rotulo} className="flex h-full flex-1 flex-col items-center gap-2">
                  <span className="tabular text-xs font-medium">{n1(b.valor)}</span>
                  <div className="flex w-full flex-1 items-end rounded-md bg-secondary">
                    <div
                      className="w-full rounded-md bg-primary transition-[height] duration-700"
                      style={{ height: `${b.valor * 10}%` }}
                    />
                  </div>
                  <span className="tabular text-[11px] text-muted-foreground">{b.rotulo}</span>
                </div>
              ))}
            </div>
          </div>


          <aside className="rounded-lg border border-border bg-card p-6 lg:col-span-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Boletim individual
              </p>
              <Selo s={situacaoDe(selecionado)} />
            </div>
            <h2 className="mt-3 text-xl font-semibold">{selecionado.nome}</h2>
            <p className="tabular mt-1 text-xs text-muted-foreground">
              Turma {selecionado.turma} · Matrícula {selecionado.matricula}
            </p>

            <div className="mt-4 flex gap-6 border-y border-border py-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Média</p>
                <p className="tabular text-lg font-semibold">{n1(media(selecionado))}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Frequência</p>
                <p className="tabular text-lg font-semibold">{selecionado.frequencia}%</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Faltas</p>
                <p className="tabular text-lg font-semibold">
                  {selecionado.disciplinas.reduce((t, d) => t + d.faltas, 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {selecionado.disciplinas.map((d) => {
                const cor =
                  d.nota >= 7 ? "bg-success" : d.nota >= 5 ? "bg-warning" : "bg-destructive";
                const texto =
                  d.nota >= 7 ? "text-success" : d.nota >= 5 ? "text-warning" : "text-destructive";
                return (
                  <div key={d.nome}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{d.nome}</span>
                      <span className={`tabular text-sm font-medium ${texto}`}>{n1(d.nota)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${cor}`}
                        style={{ width: `${d.nota * 10}%` }}
                      />
                    </div>
                    <p className="tabular mt-1 text-[11px] text-muted-foreground">
                      {d.faltas} falta{d.faltas === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <section className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Alunos</h2>
              <p className="tabular mt-0.5 text-xs text-muted-foreground">
                {lista.length} registro{lista.length === 1 ? "" : "s"} · ordenado por média
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar aluno…"
                className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
              {(["todos", "aprovado", "recuperacao", "reprovado"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`h-9 rounded-md px-3 text-xs font-medium transition-colors ${
                    filtro === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {f === "todos" ? "Todos" : rotuloSituacao[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Aluno</th>
                  <th className="px-4 py-3 font-medium">Turma</th>
                  <th className="px-4 py-3 text-right font-medium">Média</th>
                  <th className="px-4 py-3 text-right font-medium">Frequência</th>
                  <th className="px-6 py-3 text-right font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelecionado(a)}
                    className={`cursor-pointer transition-colors hover:bg-accent/40 ${
                      a.id === selecionado.id ? "bg-accent/50" : ""
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <p className="font-medium">{a.nome}</p>
                      <p className="tabular text-[11px] text-muted-foreground">
                        Mat. {a.matricula}
                      </p>
                    </td>
                    <td className="tabular px-4 py-3.5 text-xs text-muted-foreground">{a.turma}</td>
                    <td className="tabular px-4 py-3.5 text-right font-medium">{n1(media(a))}</td>
                    <td className="tabular px-4 py-3.5 text-right">{a.frequencia}%</td>
                    <td className="px-6 py-3.5 text-right">
                      <Selo s={situacaoDe(a)} />
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Nenhum aluno encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="tabular mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground">
          <span>Painel Acadêmico · dados de demonstração</span>
          <span>Atualizado em 22 de setembro de 2026</span>
        </footer>
      </main>
    </div>
  );
}
