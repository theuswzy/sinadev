import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
export function AcademicShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const queryClient = useQueryClient(); const navigate = useNavigate();
  async function logout() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); void navigate({ to: "/auth", replace: true }); }
  return <div className="min-h-screen bg-background text-foreground"><header className="bg-brand text-brand-foreground"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-8"><Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold"><GraduationCap className="size-8" />SINA</Link><div className="flex items-center gap-4"><span className="text-sm text-brand-muted">{title}</span><Button type="button" size="sm" variant="outline" onClick={logout} className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground"><LogOut /> Sair</Button></div></div></header><main className="mx-auto max-w-7xl px-6 py-10 lg:px-8"><p className="text-xs font-bold uppercase text-primary">{title}</p><h1 className="mt-2 font-display text-3xl font-semibold">{subtitle}</h1>{children}</main></div>;
}
