import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, Moon, Sun, LayoutDashboard, ShieldCheck, UserRound, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getRole } from "@/lib/sina-data";

export function AcademicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const role = useQuery({ queryKey: ["my-role"], queryFn: getRole });

  useEffect(() => {
    const saved = localStorage.getItem("sina-theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("sina-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

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
      <header className="sticky top-0 z-40 border-b border-brand-border bg-brand text-brand-foreground shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold">
            <GraduationCap className="size-8" />SINA
          </Link>
          <nav aria-label="Navegação principal" className="order-3 flex w-full items-center gap-2 overflow-x-auto sm:order-none sm:w-auto">
            <Link to="/painel" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-muted transition hover:bg-brand-panel hover:text-brand-foreground">
              <LayoutDashboard className="size-4" /> Painel
            </Link>
            <Link to={area.href} className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-panel px-3 py-2 text-sm font-semibold text-brand-foreground transition hover:opacity-90">
              <area.Icon className="size-4" /> {area.label}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-brand-muted lg:inline">{title}</span>
            <Button type="button" size="icon" variant="outline" onClick={toggleTheme} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logout} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground">
              <LogOut /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{title}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{subtitle}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
