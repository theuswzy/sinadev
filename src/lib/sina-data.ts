import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type Student = Tables<"students">;
export type Grade = Tables<"grades">;
export type UserRole = "teacher" | "student" | "admin";
export type AcademicArea = "/aluno" | "/professor" | "/admin";

export async function getRole(): Promise<UserRole> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Entre na sua conta para continuar.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.status === "suspended") {
    throw new Error("Sua conta está suspensa. Procure o administrador da instituição.");
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .in("role", ["admin", "teacher"]);
  if (error) throw error;

  const roles = data?.map((item) => item.role) ?? [];
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return "teacher";
  return "student";
}

export function routeForRole(role: UserRole): AcademicArea {
  return role === "admin" ? "/admin" : role === "teacher" ? "/professor" : "/aluno";
}
export type TeacherStudent = {
  id: string;
  full_name: string;
  enrollment: string;
  classroom: string;
  classroom_id: string | null;
  attendance: number | null;
  teacher_id: string | null;
};

export async function loadStudents(): Promise<TeacherStudent[]> {
  const { data, error } = await supabase.rpc("teacher_list_roster");
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


export type StudentAnnouncement = Tables<"announcements"> & {
  attachment_url: string | null;
};

export type StudentTask = {
  id: string;
  classroom: string;
  subject: string;
  title: string;
  description: string;
  due_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  attachment_url: string | null;
  created_at: string;
  completed: boolean;
};

async function addAttachmentUrls<T extends {
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
}>(items: T[]) {
  return Promise.all(
    items.map(async (item) => {
      if (!item.attachment_path) return { ...item, attachment_url: null };
      const { data, error } = await supabase.storage
        .from("academic-attachments")
        .createSignedUrl(item.attachment_path, 60 * 60);
      return {
        ...item,
        attachment_url: error ? null : data.signedUrl,
      };
    }),
  );
}

export async function loadAnnouncements(): Promise<StudentAnnouncement[]> {
  const { data, error } = await supabase.rpc("student_list_announcements");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Tables<"announcements">[]);
}

export async function loadTasks(): Promise<StudentTask[]> {
  const { data, error } = await supabase.rpc("student_list_tasks");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Omit<StudentTask, "attachment_url" | "completed">[]).then(
    (items) => items.map((item) => ({ ...item, completed: (data ?? []).find((task) => task.id === item.id)?.completed ?? false })),
  ) as Promise<StudentTask[]>;
}

export async function setTaskCompleted(taskId: string, completed: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("student_set_task_completed", {
    _task_id: taskId,
    _completed: completed,
  });
  if (error) throw error;
  return data ?? false;
}


export type StudentNotification = Tables<"notifications">;

export async function loadNotifications(unreadOnly = false): Promise<StudentNotification[]> {
  const { data, error } = await supabase.rpc("student_list_notifications", {
    _unread_only: unreadOnly,
    _limit: 30,
  });
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("student_mark_notification_read", {
    _id: notificationId,
  });
  if (error) throw error;
  return data ?? false;
}
