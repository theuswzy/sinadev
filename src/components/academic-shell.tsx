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
  CheckCircle2,
  Building2,
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
  const institutions = useQuery({
    queryKey: ["my-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_list_institutions");
      if (error) throw error;
      return data ?? [];
    },
  });

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
          { href: "/professor", label: "Dashboard", Icon: LayoutDashboard, route: true },
          { href: "/professor/turmas", label: "Turmas", Icon: Users, route: true },
          { href: "/professor/disciplinas", label: "Disciplinas", Icon: BookOpen, route: true },
          { href: "/professor/notas", label: "Notas", Icon: BarChart3, route: true },
          { href: "/professor/frequencia", label: "Frequência", Icon: CheckCircle2, route: true },
          { href: "/professor/avaliacoes", label: "Avaliações", Icon: ClipboardCheck, route: true },
          { href: "/professor/atividades", label: "Atividades", Icon: ClipboardList, route: true },
          { href: "/professor/agenda", label: "Agenda", Icon: CalendarDays, route: true },
          { href: "/professor/comunicacao", label: "Comunicação", Icon: Megaphone, route: true },
        ]
      : role.data === "student"
        ? [
            { href: "/aluno", label: "Dashboard", Icon: LayoutDashboard, route: true },
            { href: "/aluno/tarefas", label: "Tarefas", Icon: ClipboardList, route: true },
            { href: "/aluno/disciplinas", label: "Disciplinas", Icon: BookOpen, route: true },
            { href: "/aluno/notas", label: "Notas", Icon: BarChart3, route: true },
            { href: "/aluno/frequencia", label: "Frequência", Icon: CheckCircle2, route: true },
            { href: "/aluno/agenda", label: "Agenda", Icon: CalendarDays, route: true },
            { href: "/aluno/avisos", label: "Avisos", Icon: Bell, route: true },
          ]
        : role.data === "admin"
          ? [
              { href: "/admin", label: "Administração", Icon: ShieldCheck, route: true },
            ]
          : [];

  function isActive(item: ShellLink) {
    if (item.route) return location.pathname === item.href;
    if (location.hash && item.href.startsWith("#")) return location.hash === item.href;
    return item.href === "/professor" && location.pathname === "/professor";
  }

  const roleLabel =
    role.data === "teacher"
      ? "Área do professor"
      : role.data === "student"
        ? "Área do aluno"
        : role.data === "admin"
          ? "Administração"
          : "SINA";

  const roleShort =
    role.data === "teacher"
      ? "Professor"
      : role.data === "student"
        ? "Aluno"
        : role.data === "admin"
          ? "Administrador"
          : "SINA";

  const renderNavItem = (item: ShellLink) => {
    const active = isActive(item);
    const className = active
      ? "inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
      : "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

    if (item.route) {
      return (
        <Link
          key={item.href}
          to={item.href as any}
          className={className}
          aria-current={active ? "page" : undefined}
          onClick={() => setMobileOpen(false)}
        >
          <item.Icon className="size-[17px]" />
          <span>{item.label}</span>
        </Link>
      );
    }

    return (
      <a
        key={item.href}
        href={item.href}
        className={className}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <item.Icon className="size-[17px]" />
        <span>{item.label}</span>
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-3 sm:px-5 lg:px-8">
          <div className="flex min-h-[68px] items-center gap-3">
            <Link
              to={area.href}
              aria-label="SINA — Dashboard"
              className="flex shrink-0 items-center gap-2.5 font-display text-xl font-bold tracking-tight"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <GraduationCap className="size-5" />
              </span>
              <span className="hidden sm:inline">SINA</span>
            </Link>

            <div className="hidden h-8 w-px bg-border md:block" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold">{title}</p>
                <span className="hidden shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:inline-flex">
                  Portal acadêmico
                </span>
              </div>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              {institutions.data && institutions.data.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
                  <Building2 className="size-4 text-primary" />
                  <select
                    aria-label="Instituição ativa"
                    value={institutions.data.find((institution) => institution.is_active)?.id ?? institutions.data[0]?.id ?? ""}
                    onChange={async (event) => {
                      if (!event.target.value) return;
                      const { error } = await supabase.rpc("account_set_institution", { _institution_id: event.target.value });
                      if (error) return;
                      await queryClient.invalidateQueries();
                      window.location.reload();
                    }}
                    className="max-w-48 bg-transparent text-xs font-semibold outline-none"
                  >
                    {institutions.data.map((institution) => (
                      <option key={institution.id} value={institution.id}>{institution.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {roleShort}
              </span>
              <ThemeToggle />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl px-3"
                onClick={() => void navigate({ to: "/perfil" })}
                aria-label="Meu perfil"
                title="Meu perfil"
              >
                <UserRound className="size-4" />
                <span className="hidden lg:inline">Perfil</span>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={logout} className="rounded-xl">
                <LogOut className="mr-2 size-4" />
                Sair
              </Button>
            </div>

            <div className="flex items-center gap-1 md:hidden">
              <ThemeToggle />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-xl"
                aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
                onClick={() => setMobileOpen((value) => !value)}
              >
                {mobileOpen ? <X /> : <Menu />}
              </Button>
            </div>
          </div>

          <nav
            aria-label="Navegação principal"
            className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 pb-3 md:mx-0 md:px-0"
          >
            {sectionLinks.map(renderNavItem)}
          </nav>

          {mobileOpen && (
            <div className="border-t border-border py-3 md:hidden">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void navigate({ to: "/perfil" });
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold"
                >
                  <UserRound className="size-4 text-primary" />
                  Meu perfil
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-semibold text-muted-foreground"
                >
                  <LogOut className="size-4" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="min-h-[calc(100vh-116px)]">
        <div className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">
          <div className="mb-5 md:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{roleLabel}</p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight">{subtitle}</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
