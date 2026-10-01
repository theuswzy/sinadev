import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, LayoutDashboard, ShieldCheck, UserRound, Users, BookOpen, ClipboardList, Megaphone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/sina-data";

export function AcademicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const area = role.data === "admin" ? { href: "/admin" as const, label: "Admin", Icon: ShieldCheck } :
    role.data === "teacher" ? { href: "/professor" as const, label: "Professor", Icon: Users } :
    { href: "/aluno" as const, label: "Aluno", Icon: UserRound };

  const sectionLinks = role.data === "teacher"
    ? [
        { href: "#inicio", label: "Visão geral", Icon: LayoutDashboard },
        { href: "#alunos", label: "Alunos", Icon: Users },
        { href: "#lancamentos", label: "Lançamentos", Icon: BookOpen },
        { href: "#central-turma", label: "Central", Icon: ClipboardList },
        { href: "#comunicacao", label: "Comunicação", Icon: Megaphone },
        { href: "/perfil", label: "Perfil", Icon: UserRound, route: true },
      ]
    : role.data === "student"
      ? [
          { href: "/aluno", label: "Visão geral", Icon: LayoutDashboard, route: true },
          { href: "/aluno#tarefas", label: "Tarefas", Icon: ClipboardList },
          { href: "/aluno#disciplinas", label: "Disciplinas", Icon: BookOpen },
          { href: "/aluno#notas", label: "Notas", Icon: BookOpen },
          { href: "/aluno#academico", label: "Vida acadêmica", Icon: ClipboardList },
          { href: "/perfil", label: "Perfil", Icon: UserRound, route: true },
        ]
      : role.data === "admin"
        ? [
            { href: "/admin", label: "Administração", Icon: ShieldCheck, route: true },
            { href: "/perfil", label: "Perfil", Icon: UserRound, route: true },
          ]
        : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-brand/95 text-brand-foreground shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to={area.href} aria-label="SINA — voltar ao painel" className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-2 font-display text-xl font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-panel text-primary ring-1 ring-brand-border transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="size-5" />
            </span>
            <span>SINA</span>
          </Link>

          <nav aria-label="Navegação principal" className="ml-2 hidden max-w-[680px] items-center gap-0.5 overflow-x-auto rounded-xl border border-brand-border/80 bg-brand-panel/60 p-1 sm:flex">
            {sectionLinks.map(({ href, label, Icon, route }, index) => {
              const active = route ? location.pathname === href : index === 0 && location.pathname === "/aluno";
              const className = active
                ? "flex shrink-0 items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand-border/70"
                : "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-brand-panel hover:text-brand-foreground";

              return route ? (
                <Link key={href} to={href as "/aluno" | "/perfil"} aria-current={active ? "page" : undefined} className={className}>
                  <Icon className={active ? "size-4 text-primary" : "size-4"} />
                  <span>{label}</span>
                </Link>
              ) : (
                <a key={href} href={href} aria-current={active ? "page" : undefined} className={className}>
                  <Icon className={active ? "size-4 text-primary" : "size-4"} />
                  <span>{label}</span>
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-brand-border bg-brand-panel/70 px-3 py-1.5 text-xs font-medium text-brand-muted lg:inline-flex">{title}</span>
            <ThemeToggle />
            <Button type="button" size="sm" variant="outline" onClick={logout} className="border-brand-border bg-transparent text-brand-foreground shadow-none transition-colors hover:bg-brand-panel hover:text-brand-foreground">
              <LogOut />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        <nav aria-label="Navegação móvel" className="flex gap-1 overflow-x-auto border-t border-brand-border/60 px-4 py-2 sm:hidden">
          {sectionLinks.map(({ href, label, Icon, route }, index) => {
            const active = route ? location.pathname === href : index === 0 && location.pathname === "/aluno";
            const className = active
              ? "flex shrink-0 items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground"
              : "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-panel hover:text-brand-foreground";

            return route ? (
              <Link key={href} to={href as "/aluno" | "/perfil"} aria-current={active ? "page" : undefined} className={className}>
                <Icon className={active ? "size-4 text-primary" : "size-4"} />
                {label}
              </Link>
            ) : (
              <a key={href} href={href} className={className}>
                <Icon className={active ? "size-4 text-primary" : "size-4"} />
                {label}
              </a>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <div className="mb-1 max-w-3xl">
          <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{subtitle}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
