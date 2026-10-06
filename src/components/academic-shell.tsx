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
  FileText,
  ChevronDown,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { getRole, type UserRole } from "@/lib/sina-data";

type AcademicNavPath = "/admin" | "/aluno" | "/aluno/tarefas" | "/aluno/disciplinas" | "/aluno/notas" | "/aluno/frequencia" | "/aluno/agenda" | "/aluno/avisos" | "/aluno/materiais" | "/aluno/notificacoes" | "/professor" | "/professor/turmas" | "/professor/alunos" | "/professor/disciplinas" | "/professor/notas" | "/professor/frequencia" | "/professor/avaliacoes" | "/professor/atividades" | "/professor/materiais" | "/professor/agenda" | "/professor/comunicacao";

type ShellErrorBoundaryProps = { children: ReactNode };
type ShellErrorBoundaryState = { hasError: boolean; message: string };

class ShellErrorBoundary extends Component<ShellErrorBoundaryProps, ShellErrorBoundaryState> {
  override state: ShellErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): ShellErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Ocorreu um erro inesperado ao carregar esta área.",
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[SINA] Erro ao renderizar área acadêmica:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="sina-card mt-6 p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold">Não foi possível carregar esta página</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O SINA encontrou uma falha momentânea ao montar esta área. Tente novamente sem sair da conta.
            </p>
            {this.state.message && (
              <p className="mt-3 break-words rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {this.state.message}
              </p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={this.handleRetry}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}

type ShellLink = {
  href: AcademicNavPath;
  label: string;
  Icon: typeof LayoutDashboard;
  route?: boolean;
};

export function AcademicShell({
  title,
  subtitle,
  children,
  requiredRole,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  requiredRole?: UserRole;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navGroup, setNavGroup] = useState<"academic" | "content" | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let refreshTimer: number | null = null;

    const refreshAcademicQueries = () => {
      if (cancelled) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        // Keep the three panels in sync after a change made by another panel.
        // A teacher publishing an activity, for example, invalidates the
        // student's dashboard; an admin changing a classroom invalidates the
        // teacher/student academic context as well.
        const prefixes = ["my-", "dashboard-", "teacher-", "student-", "admin-"];
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const key = (query.queryKey as readonly unknown[])[0];
            return typeof key === "string" && prefixes.some((prefix) => key === prefix || key.startsWith(prefix));
          },
        });
      }, 180);
    };

    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      channel = supabase.channel("sina-academic-realtime-" + userId);

      // Membership/context changes affect authorization and tenant selection.
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "institution_memberships", filter: "user_id=eq." + userId },
          refreshAcademicQueries,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_institution_context", filter: "user_id=eq." + userId },
          refreshAcademicQueries,
        )
        // Student linkage is user-specific, so this is the most important
        // cross-panel signal for admin/teacher -> student changes.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "students", filter: "user_id=eq." + userId },
          refreshAcademicQueries,
        );

      // Academic records are protected by Supabase RLS. Realtime therefore
      // only delivers rows the current account is allowed to receive.
      for (const table of [
        "profiles",
        "user_roles",
        "account_role_requests",
        "institution_invitations",
        "grades",
        "attendance_records",
        "tasks",
        "task_submissions",
        "task_completions",
        "announcements",
        "assessments",
        "assessment_scores",
        "academic_materials",
        "calendar_events",
        "notifications",
        "classrooms",
        "subjects",
        "academic_terms",
        "classroom_subjects",
        "classroom_teachers",
        "students",
        "audit_logs",
      ] as const) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          refreshAcademicQueries,
        );
      }

      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole, staleTime: 5 * 60_000 });
  const institutions = useQuery({
    queryKey: ["my-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_list_institutions");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
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
          { href: "/professor/alunos", label: "Alunos", Icon: GraduationCap, route: true },
          { href: "/professor/disciplinas", label: "Disciplinas", Icon: BookOpen, route: true },
          { href: "/professor/notas", label: "Notas", Icon: BarChart3, route: true },
          { href: "/professor/frequencia", label: "Frequência", Icon: CheckCircle2, route: true },
          { href: "/professor/avaliacoes", label: "Avaliações", Icon: ClipboardCheck, route: true },
          { href: "/professor/atividades", label: "Atividades", Icon: ClipboardList, route: true },
          { href: "/professor/materiais", label: "Materiais", Icon: FileText, route: true },
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
            { href: "/aluno/materiais", label: "Materiais", Icon: FileText, route: true },
            { href: "/aluno/notificacoes", label: "Notificações", Icon: Bell, route: true },
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

  const accessBlocked = requiredRole && !role.isPending && !role.error && role.data !== requiredRole;
  const accessMessage = requiredRole
    ? accessBlocked
      ? "Esta área é exclusiva para professores autorizados."
      : null
    : null;

  async function retryAcademicAccess() {
    await Promise.all([
      role.refetch(),
      institutions.refetch(),
    ]);
  }

  const renderNavItem = (item: ShellLink) => {
    const active = isActive(item);
    const className = active
      ? "inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
      : "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

    if (item.route) {
      return (
        <Link
          key={item.href}
          to={item.href as AcademicNavPath}
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

            <div className="flex items-center gap-2">
              {institutions.data && institutions.data.length > 0 && (() => {
                const institution = institutions.data[0];
                if (!institution) return null;
                return (
                  <div className="flex max-w-[220px] items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                    <Building2 className="size-4 shrink-0 text-primary" />
                    {institutions.data.length === 1 ? (
                      <span className="truncate text-xs font-semibold" title={institution.name}>
                        {institution.name}
                      </span>
                  ) : (
                    <select
                      aria-label="Instituição ativa"
                      value={institutions.data.find((institution) => institution.is_active)?.id ?? institutions.data[0]?.id ?? ""}
                      onChange={async (event) => {
                        if (!event.target.value) return;
                        const { error } = await supabase.rpc("account_set_institution", { _institution_id: event.target.value });
                        if (error) {
                          console.error("[SINA] Não foi possível trocar a instituição:", error);
                          toast.error("Não foi possível trocar de instituição.");
                          return;
                        }
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ["my-role"] }),
                          queryClient.invalidateQueries({ queryKey: ["my-institutions"] }),
                          queryClient.invalidateQueries({
                            predicate: (query) => {
                              const key = String(query.queryKey[0] ?? "");
                              return key.startsWith("teacher-") || key.startsWith("student-") || key.startsWith("admin-");
                            },
                          }),
                        ]);
                        toast.success("Instituição ativa atualizada.");
                      }}
                      className="max-w-[120px] bg-transparent text-xs font-semibold outline-none sm:max-w-48"
                    >
                      {institutions.data.map((institution) => (
                        <option key={institution.id} value={institution.id}>{institution.name}</option>
                      ))}
                    </select>
                  )}
                  </div>
                );
              })()}
              <span className="hidden rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
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
            className={role.data === "teacher"
              ? "relative -mx-3 hidden gap-1 px-3 pb-3 md:mx-0 md:flex md:px-0"
              : "scrollbar-none -mx-3 hidden gap-1 overflow-x-auto px-3 pb-3 md:mx-0 md:flex md:px-0"}
          >
            {role.data === "teacher" ? (
              <>
                {sectionLinks.slice(0, 4).map(renderNavItem)}
                {([
                  ["academic", "Acadêmico", sectionLinks.slice(4, 7)],
                  ["content", "Conteúdo", sectionLinks.slice(7)],
                ] as const).map(([groupKey, label, items]) => {
                  const active = items.some(isActive);
                  const open = navGroup === groupKey;
                  return (
                    <div key={groupKey} className="relative shrink-0">
                      <button
                        type="button"
                        className={active
                          ? "inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
                          : "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}
                        aria-expanded={open}
                        onClick={() => setNavGroup(value => value === groupKey ? null : groupKey)}
                      >
                        <span>{label}</span>
                        <ChevronDown className={"size-4 transition-transform " + (open ? "rotate-180" : "")} />
                      </button>
                      {open && (
                        <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-56 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                          {items.map(item => {
                            const Icon = item.Icon;
                            const itemActive = isActive(item);
                            return (
                              <Link
                                key={item.href}
                                to={item.href as AcademicNavPath}
                                onClick={() => {
                                  setNavGroup(null);
                                  setMobileOpen(false);
                                }}
                                className={itemActive
                                  ? "flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
                                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}
                                aria-current={itemActive ? "page" : undefined}
                              >
                                <Icon className="size-4" />
                                <span>{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              sectionLinks.map(renderNavItem)
            )}
          </nav>

          <div className="flex items-center gap-2 border-t border-border/60 py-2 md:hidden">
            {sectionLinks.slice(0, 4).map(renderNavItem)}
            {sectionLinks.length > 4 && (
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-muted-foreground"
                aria-expanded={mobileOpen}
              >
                <Menu className="size-[17px]" />
                Mais
              </button>
            )}
          </div>

          {mobileOpen && (
            <div className="border-t border-border bg-muted/20 py-3 md:hidden">
              <div className="mb-3 grid grid-cols-2 gap-2">
                {sectionLinks.slice(4).map((item) => {
                  const Icon = item.Icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      to={item.href as AcademicNavPath}
                      onClick={() => setMobileOpen(false)}
                      className={active ? "flex items-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground" : "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold text-muted-foreground"}
                    >
                      <Icon className="size-4" />{item.label}
                    </Link>
                  );
                })}
              </div>
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
          {role.isPending && requiredRole ? (
            <div className="sina-card mt-6 p-6">Verificando acesso…</div>
          ) : role.error && requiredRole ? (
            <div className="sina-card mt-6 p-6">
              <h2 className="font-display text-base font-bold">Não foi possível validar seu acesso</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Houve uma falha momentânea na comunicação com o SINA. Você pode tentar novamente sem sair da conta.
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void retryAcademicAccess()}>
                Tentar novamente
              </Button>
            </div>
          ) : accessMessage ? (
            <div className="sina-card mt-6 p-6 text-sm">{accessMessage}</div>
          ) : (
            <ShellErrorBoundary>{children}</ShellErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
}