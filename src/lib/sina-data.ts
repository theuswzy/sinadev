import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type Student = Tables<"students">;
export type Grade = Tables<"grades">;
export async function getRole(): Promise<"teacher" | "student"> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Entre na sua conta para continuar.");
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "teacher").maybeSingle();
  if (error) throw error;
  return data ? "teacher" : "student";
}
export async function loadStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from("students").select("*").order("full_name");
  if (error) throw error;
  return data ?? [];
}
export async function loadGrades(studentId: string): Promise<Grade[]> {
  const { data, error } = await supabase.from("grades").select("*").eq("student_id", studentId).order("subject").order("period");
  if (error) throw error;
  return data ?? [];
}
export const formatScore = (n: number) => n.toFixed(1).replace(".", ",");
export const errorText = (err: unknown) => err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.";
