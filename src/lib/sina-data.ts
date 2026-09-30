import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type Student = Tables<"students">;
export type Grade = Tables<"grades">;
export async function getRole(): Promise<"teacher" | "student" | "admin"> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Entre na sua conta para continuar.");
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).in("role", ["admin", "teacher"]).order("role").limit(1).maybeSingle();
  if (error) throw error;
  return data?.role === "admin" ? "admin" : data?.role === "teacher" ? "teacher" : "student";
}
export async function loadStudents(): Promise<Student[]> {
  const { data, error } = await supabase.rpc("teacher_list_students");
  if (error) throw error;
  return data ?? [];
}

export async function loadMyStudent(): Promise<Student | null> {
  const { data, error } = await supabase.rpc("student_get_profile");
  if (error) throw error;

  const existing = data?.[0] ?? null;
  if (existing) return existing;

  // A criação é feita apenas quando o perfil ainda não existe.
  // Isso evita writes repetidos durante a atualização automática do dashboard.
  const { error: ensureError } = await supabase.rpc("ensure_student_profile");
  if (ensureError) throw ensureError;

  const { data: refreshed, error: refreshError } = await supabase.rpc("student_get_profile");
  if (refreshError) throw refreshError;
  return refreshed?.[0] ?? null;
}
export async function loadGrades(studentId: string): Promise<Grade[]> {
  const { data, error } = await supabase.from("grades").select("*").eq("student_id", studentId).order("subject").order("period");
  if (error) throw error;
  return data ?? [];
}
export const formatScore = (n: number) => n.toFixed(1).replace(".", ",");
export const errorText = (err: unknown) => err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.";
