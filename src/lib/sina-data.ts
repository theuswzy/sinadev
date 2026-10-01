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


export type StudentNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

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

export type TeacherClassroom = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  student_count: number;
};

export type AttendanceRow = {
  student_id: string;
  full_name: string;
  enrollment: string;
  status: "present" | "absent" | "late" | "excused";
  note: string;
};

export type TeacherAssessment = {
  id: string;
  title: string;
  assessment_type: string;
  weight: number;
  max_score: number;
  due_at: string | null;
  status: string;
  subject_id: string | null;
  subject_name: string;
  term_id: string | null;
  term_name: string;
};

export type StudentAssessment = {
  id: string;
  title: string;
  assessment_type: string;
  weight: number;
  max_score: number;
  due_at: string | null;
  status: string;
  subject_name: string;
  term_name: string;
  score: number | null;
  feedback: string | null;
};

export type TaskSubmission = {
  id: string;
  task_id: string;
  student_id: string;
  student_name: string;
  enrollment: string;
  content: string;
  status: string;
  submitted_at: string;
  score: number | null;
  feedback: string | null;
};

export type StudentTaskSubmission = {
  id: string;
  task_id: string;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  status: string;
  submitted_at: string;
  score: number | null;
  feedback: string | null;
};

export type CalendarEvent = {
  id: string;
  classroom_id: string | null;
  classroom_name: string | null;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  event_type: string;
  status: string;
};

export type AcademicOptions = {
  subjects: { id: string; name: string; code: string | null }[];
  terms: { id: string; name: string; starts_at: string | null; ends_at: string | null; is_current: boolean }[];
};

export type AdminAcademicSetup = {
  classrooms: { id: string; name: string; code: string | null; status: string }[];
  subjects: { id: string; name: string; code: string | null; status: string }[];
  terms: { id: string; name: string; starts_at: string | null; ends_at: string | null; is_current: boolean }[];
};

export async function loadTeacherClassrooms(): Promise<TeacherClassroom[]> {
  const { data, error } = await supabase.rpc("teacher_list_classrooms");
  if (error) throw error;
  return (data ?? []) as TeacherClassroom[];
}

export async function loadAttendance(classroomId: string, date: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.rpc("teacher_get_attendance", { _classroom_id: classroomId, _date: date });
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function saveAttendance(classroomId: string, date: string, rows: Pick<AttendanceRow, "student_id" | "status" | "note">[]): Promise<number> {
  const { data, error } = await supabase.rpc("teacher_save_attendance", {
    _classroom_id: classroomId,
    _date: date,
    _rows: rows,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function loadTeacherAcademicOptions(): Promise<AcademicOptions> {
  const { data, error } = await supabase.rpc("teacher_list_academic_options");
  if (error) throw error;
  return (data ?? { subjects: [], terms: [] }) as AcademicOptions;
}

export async function loadTeacherAssessments(classroomId: string): Promise<TeacherAssessment[]> {
  const { data, error } = await supabase.rpc("teacher_list_assessments", { _classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as TeacherAssessment[];
}

export async function createAssessment(args: {
  classroomId: string;
  subjectId: string | null;
  termId: string | null;
  title: string;
  type: string;
  weight: number;
  maxScore: number;
  dueAt: string | null;
}) {
  const { data, error } = await supabase.rpc("teacher_create_assessment", {
    _classroom_id: args.classroomId,
    _subject_id: args.subjectId,
    _term_id: args.termId,
    _title: args.title,
    _type: args.type,
    _weight: args.weight,
    _max_score: args.maxScore,
    _due_at: args.dueAt,
  });
  if (error) throw error;
  return data;
}

export async function loadStudentAssessments(): Promise<StudentAssessment[]> {
  const { data, error } = await supabase.rpc("student_list_assessments");
  if (error) throw error;
  return (data ?? []) as StudentAssessment[];
}

export async function submitTask(taskId: string, content: string) {
  const { data, error } = await supabase.rpc("student_submit_task", { _task_id: taskId, _content: content });
  if (error) throw error;
  return data;
}

export async function loadStudentTaskSubmissions(): Promise<StudentTaskSubmission[]> {
  const { data, error } = await supabase.rpc("student_list_task_submissions");
  if (error) throw error;
  return (data ?? []) as StudentTaskSubmission[];
}

export async function loadTaskSubmissions(taskId: string): Promise<TaskSubmission[]> {
  const { data, error } = await supabase.rpc("teacher_list_task_submissions", { _task_id: taskId });
  if (error) throw error;
  return (data ?? []) as TaskSubmission[];
}

export async function gradeTaskSubmission(submissionId: string, score: number | null, feedback: string) {
  const { data, error } = await supabase.rpc("teacher_grade_submission", {
    _submission_id: submissionId,
    _score: score,
    _feedback: feedback,
  });
  if (error) throw error;
  return data ?? false;
}

export async function loadStudentAttendance(): Promise<{ attendance_date: string; status: string; note: string | null; classroom: string }[]> {
  const { data, error } = await supabase.rpc("student_list_attendance", { _limit: 90 });
  if (error) throw error;
  return data ?? [];
}

export async function loadTeacherCalendar(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.rpc("teacher_list_calendar", { _from: from, _to: to });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function loadStudentCalendar(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.rpc("student_list_calendar", { _from: from, _to: to });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function createTeacherCalendarEvent(args: {
  classroomId: string | null;
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  eventType: string;
}) {
  const { data, error } = await supabase.rpc("teacher_create_calendar_event", {
    _classroom_id: args.classroomId,
    _title: args.title,
    _description: args.description,
    _start_at: args.startAt,
    _end_at: args.endAt,
    _event_type: args.eventType,
  });
  if (error) throw error;
  return data;
}

export type TeacherClassReport = {
  student_id: string;
  student_name: string;
  enrollment: string;
  attendance_percent: number | null;
  grade_average: number;
  assessment_count: number;
};

export async function loadTeacherClassReport(classroomId: string): Promise<TeacherClassReport[]> {
  const { data, error } = await supabase.rpc("teacher_get_class_report", { _classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as TeacherClassReport[];
}

export async function loadAdminAcademicSetup(): Promise<AdminAcademicSetup> {
  const { data, error } = await supabase.rpc("admin_list_academic_setup");
  if (error) throw error;
  return (data ?? { classrooms: [], subjects: [], terms: [] }) as AdminAcademicSetup;
}

export async function adminUpsertClassroom(id: string | null, name: string, code: string) {
  const { data, error } = await supabase.rpc("admin_upsert_classroom", { _id: id, _name: name, _code: code });
  if (error) throw error;
  return data;
}

export async function adminArchiveClassroom(id: string) {
  const { data, error } = await supabase.rpc("admin_archive_classroom", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function adminUpsertSubject(id: string | null, name: string, code: string) {
  const { data, error } = await supabase.rpc("admin_upsert_subject", { _id: id, _name: name, _code: code });
  if (error) throw error;
  return data;
}

export async function adminUpsertTerm(id: string | null, name: string, startsAt: string | null, endsAt: string | null, isCurrent: boolean) {
  const { data, error } = await supabase.rpc("admin_upsert_term", {
    _id: id,
    _name: name,
    _starts_at: startsAt,
    _ends_at: endsAt,
    _is_current: isCurrent,
  });
  if (error) throw error;
  return data;
}

