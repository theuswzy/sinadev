import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ChartNoAxesCombined, ClipboardList, GraduationCap, LockKeyhole, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import learningImage from "@/assets/sina-learning.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conheça o SINA — Acompanhamento acadêmico" },
      { name: "description", content: "Conheça o SINA, o sistema digital para acompanhar notas e frequência com áreas próprias para alunos e professores." },
      { property: "og:title", content: "Conheça o SINA — Acompanhamento acadêmico" },
      { property: "og:description", content: "Notas, frequência e acompanhamento acadêmico em um só lugar para alunos e professores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PresentationPage,
});

const benefits = [
  { icon: ClipboardList, number: "01", title: "Registros organizados", description: "Notas por disciplina e bimestre, frequência e informações da turma reunidas em um único lugar." },
  { icon: ChartNoAxesCombined, number: "02", title: "Acompanhamento claro", description: "Uma visão direta do percurso acadêmico para facilitar a consulta e o acompanhamento." },
  { icon: LockKeyhole, number: "03", title: "Acesso individual", description: "Cada aluno consulta apenas seus próprios dados. Professores acessam os registros das suas turmas." },
];

function PresentationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative z-20 border-b border-brand-border bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link to="/" aria-label="SINA — início" className="flex shrink-0 items-center gap-2 font-display text-2xl font-bold">
            <GraduationCap aria-hidden="true" className="size-8 stroke-[1.5]" /> SINA
          </Link>
          <nav aria-label="Navegação" className="flex items-center gap-4 text-sm sm:gap-7">
            <a href="#sobre" className="hidden text-brand-foreground/75 transition-colors hover:text-brand-foreground sm:inline">Sobre</a>
            <Link to="/auth" className="inline-flex items-center gap-2 border-b border-primary pb-1 font-semibold text-brand-foreground transition-colors hover:text-brand-muted">Acessar <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[520px] items-center overflow-hidden bg-brand text-brand-foreground sm:min-h-[570px] lg:min-h-[650px]">
          <img src={learningImage} width={1536} height={1024} alt="Estudantes analisando materiais de estudo juntos" className="absolute inset-0 h-full w-full object-cover object-[58%_center]" />
          <div className="absolute inset-0 bg-brand/60 sm:bg-brand/35" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
            <div className="max-w-[660px]">
              <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase text-brand-muted"><span className="h-px w-8 bg-primary" /> Sistema digital acadêmico</p>
              <h1 className="font-display text-5xl font-semibold leading-[1.12] sm:text-6xl lg:text-7xl">SINA<span className="text-primary">.</span></h1>
              <p className="mt-5 max-w-xl font-display text-2xl font-medium leading-snug sm:text-3xl">Acompanhar a vida acadêmica ficou mais simples.</p>
              <p className="mt-5 max-w-lg text-sm leading-7 text-brand-foreground/85 sm:text-base">Um espaço para reunir notas, frequência e informações acadêmicas, aproximando alunos e professores do que importa.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-11 px-6 font-semibold"><Link to="/auth">Acessar o SINA <ArrowRight aria-hidden="true" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-11 border-brand-foreground/60 bg-brand/20 px-6 text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground"><a href="#sobre">Conheça o sistema</a></Button>
              </div>
            </div>
          </div>
        </section>

        <section id="sobre" className="border-b border-border bg-card py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-16">
              <div><p className="text-xs font-bold uppercase text-success">Sobre o SINA</p><h2 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">Informação acadêmica com clareza e propósito.</h2></div>
              <div className="flex items-center"><p className="max-w-xl text-base leading-8 text-muted-foreground">O Sistema Digital para Acompanhamento de Dados Acadêmicos ajuda a organizar o dia a dia escolar. Alunos podem consultar seu desempenho, enquanto professores registram e atualizam notas e frequência em suas áreas de acesso.</p></div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <p className="text-xs font-bold uppercase text-success">O que você encontra</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">Tudo no lugar certo, para acompanhar melhor.</h2>
            <div className="mt-10 grid gap-0 border-t border-border md:grid-cols-3">
              {benefits.map(({ icon: Icon, number, title, description }) => (
                <article key={number} className="border-b border-border py-8 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                  <div className="flex items-start justify-between"><Icon aria-hidden="true" className="size-8 stroke-[1.5] text-success" /><span className="font-display text-xs font-semibold text-muted-foreground">{number}</span></div>
                  <h3 className="mt-8 font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-panel py-16 text-brand-foreground sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:px-10">
            <div><p className="text-xs font-bold uppercase text-brand-muted">Feito para quem ensina e aprende</p><h2 className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">Duas perspectivas. Um mesmo caminho.</h2></div>
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="border-t border-brand-border pt-5"><BookOpen aria-hidden="true" className="size-7 text-brand-muted" /><h3 className="mt-4 font-display text-lg font-semibold">Para alunos</h3><p className="mt-2 text-sm leading-7 text-brand-foreground/75">Consulte suas notas e sua frequência em um espaço pessoal.</p></div>
              <div className="border-t border-brand-border pt-5"><UsersRound aria-hidden="true" className="size-7 text-brand-muted" /><h3 className="mt-4 font-display text-lg font-semibold">Para professores</h3><p className="mt-2 text-sm leading-7 text-brand-foreground/75">Cadastre alunos e mantenha notas e frequência atualizadas.</p></div>
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-primary-foreground sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:px-10">
            <div><p className="text-xs font-bold uppercase">Seu espaço acadêmico</p><h2 className="mt-3 max-w-lg font-display text-3xl font-semibold leading-tight sm:text-4xl">Entre e acompanhe o que importa.</h2></div>
            <Button asChild size="lg" className="h-12 bg-brand px-7 text-brand-foreground hover:bg-brand-panel"><Link to="/auth">Entrar ou criar conta <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="bg-brand py-8 text-brand-foreground"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm sm:px-8 lg:px-10"><span className="flex items-center gap-2 font-display text-lg font-bold"><GraduationCap aria-hidden="true" className="size-6" /> SINA</span><span className="text-brand-foreground/65">Sistema Digital para Acompanhamento de Dados Acadêmicos</span></div></footer>
    </div>
  );
}