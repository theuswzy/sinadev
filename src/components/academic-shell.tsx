import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  GraduationCap,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  Users,
  BookOpen,
  ClipboardList,
  Megaphone,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/sina-data";

type ShellLink = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  route?: boolean;
};

export function AcademicShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const area =
    role.data === "admin"
      ? { href: "/admin" as const, label: "Admin", Icon: ShieldCheck }
      : role.data === "teacher"
        ? { href: "/professor" as const, label: "Professor", Icon: Users }
        : { href: "/aluno" as const, label: "Aluno", Icon: UserRound };

  const sectionLinks: ShellLink[] =
    role.data === "teacher"
      ? [
          { href: "#inicio", label: "Dashboard", Icon: LayoutDashboard },
          { href: "#alunos", label: "Alunos", Icon: Users },
          { href: "#lancamentos", label: "Notas e lançamentos", Icon: BarChart3 },
          { href: "#central-turma", label: "Turmas e atividades", Icon: ClipboardList },
          { href: "#comunicacao", label: "Comunicação", Icon: Megaphone },
          { href: "/perfil", label: "Meu perfil", Icon: UserRound, route: true },
        ]
      : role.data === "student"
        ? [
            { href: "#inicio", label: "Dashboard", Icon: LayoutDashboard },
            { href: "#tarefas", label: "Tarefas", Icon: ClipboardList },
            { href: "#disciplinas", label: "Disciplinas", Icon: BookOpen },
            { href: "#notas", label: "Notas", Icon: BarChart3 },
            { href: "#academico", label: "Vida acadêmica", Icon: ClipboardCheck },
            { href: "/perfil", label: "Meu perfil", Icon: UserRound, route: true },
          ]
        : role.data === "admin"
          ? [
              { href: "/admin", label: "Administração", Icon: ShieldCheck, route: true },
              { href: "/perfil", label: "Meu perfil", Icon: UserRound, route: true },
            ]
          : [];

  function isActive(item: ShellLink, index: number) {
    if (item.route) return location.pathname === item.href && !location.hash;
    if (location.hash && item.href.startsWith("#")) return location.hash === item.href;
    return index === 0 && (location.pathname === "/aluno" || location.pathname === "/professor");
  }

  const roleLabel =
    role.data === "teacher"
      ? "Área do professor"
      : role.data === "student"
        ? "Área do aluno"
        : role.data === "admin"
          ? "Administração"
          : "SINA";

  const roleShort = role.data === "teacher" ? "Professor" : role.data === "student" ? "Aluno" : role.data === "admin" ? "Administrador" : "SINA";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <Link to={area.href} aria-label="SINA — Dashboard" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <GraduationCap className="size-5" />
            </span>
            SINA
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Você está em</p>
            <p className="mt-1 text-sm font-semibold">{roleShort}</p>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Principal</p>
          {sectionLinks.map((item, index) => {
            const active = isActive(item, index);
            const className = active
              ? "flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary"
              : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

            return item.route ? (
              <Link key={item.href} to={item.href as "/aluno" | "/perfil" | "/admin" | "/professor"} className={className} aria-current={active ? "page" : undefined}>
                <item.Icon className="size-[18px]" />
                <span>{item.label}</span>
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={className} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>
                <item.Icon className="size-[18px]" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground">
            <Bell className="size-4" />
            <span>Área acadêmica</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button type="button" variant="outline" size="sm" onClick={logout} className="flex-1">
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center gap-3 px-4">
          <Button type="button" variant="ghost" size="icon" aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMobileOpen((value) => !value)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <Link to={area.href} className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-4" />
            </span>
            SINA
          </Link>
          <span className="ml-auto text-xs font-medium text-muted-foreground">{roleShort}</span>
          <ThemeToggle />
        </div>

        {mobileOpen && (
          <nav aria-label="Navegação móvel" className="border-t border-border bg-card px-3 py-3 shadow-lg">
            <div className="space-y-1">
              {sectionLinks.map((item, index) => {
                const active = isActive(item, index);
                const className = active
                  ? "flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-3 text-sm font-semibold text-primary"
                  : "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

                return item.route ? (
                  <Link key={item.href} to={item.href as "/aluno" | "/perfil" | "/admin" | "/professor"} className={className} onClick={() => setMobileOpen(false)}>
                    <item.Icon className="size-[18px]" />
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.href} href={item.href} className={className} onClick={() => setMobileOpen(false)}>
                    <item.Icon className="size-[18px]" />
                    {item.label}
                  </a>
                );
              })}
              <button type="button" onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="size-[18px]" />
                Sair
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <div className="mb-1 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{roleLabel}</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-foreground/70">{title}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{subtitle}</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
