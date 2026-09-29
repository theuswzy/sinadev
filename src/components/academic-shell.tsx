import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, Moon, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AcademicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-8">
          <Link to="/painel" className="flex items-center gap-2 font-display text-2xl font-bold">
            <GraduationCap className="size-8" />SINA
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/painel" className="text-sm text-brand-muted hover:text-brand-foreground">Painel</Link>
            <span className="hidden text-sm text-brand-muted sm:inline">{title}</span>
            <Button type="button" size="icon" variant="outline" onClick={toggleTheme} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={logout} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground">
              <LogOut /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <p className="text-xs font-bold uppercase text-primary">{title}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{subtitle}</h1>
        {children}
      </main>
    </div>
  );
}
