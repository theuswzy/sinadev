import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, LayoutDashboard, ShieldCheck, UserRound, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/sina-data";

export function AcademicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

          <nav aria-label="Navegação principal" className="ml-2 hidden items-center rounded-xl border border-brand-border/80 bg-brand-panel/60 p-1 sm:flex">
            <Link to={area.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted transition-all hover:bg-brand-panel hover:text-brand-foreground">
              <LayoutDashboard className="size-4" />
              <span>Painel</span>
            </Link>
            <Link to={area.href} className="flex items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-sm font-semibold text-brand-foreground shadow-sm ring-1 ring-brand-border/70" aria-current="page">
              <area.Icon className="size-4 text-primary" />
              <span>{area.label}</span>
            </Link>
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
          <Link to={area.href} className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-xs font-semibold text-brand-foreground" aria-current="page">
            <area.Icon className="size-4 text-primary" />
            {area.label}
          </Link>
          <Link to={area.href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-brand-muted hover:bg-brand-panel hover:text-brand-foreground">
            <LayoutDashboard className="size-4" />
            Painel
          </Link>
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
