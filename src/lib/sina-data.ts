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
  if (!profile) {
    throw new Error("Finalize seu cadastro para acessar o SINA.");
  }
  if (profile.status === "pending") {
    throw new Error("Sua conta está aguardando aprovação do administrador.");
  }
  if (profile.status === "suspended") {
    throw new Error("Sua conta está suspensa. Procure o administrador da instituição.");
  }

  // Resolve the role from the active institution, not from the global role table.
  // A user can belong to more than one institution and must not inherit another
  // institution's role while switching the active context.
  const { data: institutions, error: institutionError } = await supabase.rpc("account_list_institutions");
  if (institutionError) throw institutionError;

  const active = (institutions ?? []).find((item) => item.is_active) ?? institutions?.[0];
  const activeRole = active?.role as UserRole | undefined;
  if (activeRole === "admin" || activeRole === "teacher" || activeRole === "student") {
    return activeRole;
  }

  throw new Error("Sua conta ainda não possui uma função acadêmica ativa.");
}


export type OnboardingState = {
  status: "active" | "pending" | "suspended";
  role: UserRole | null;
  requested_role: "student" | "teacher" | null;
  request_status: "pending" | "approved" | "rejected" | "cancelled" | null;
  request_id: string | null;
  review_note: string | null;
};

export type SchoolDirectoryEntry = {
  id: string;
  name: string;
  municipality: string;
  state: string;
  network_type: "municipal" | "estadual" | "federal";
  inep_code: string | null;
  institution_id: string | null;
};

export async function searchSchoolDirectory(
  search = "",
  networkType?: SchoolDirectoryEntry["network_type"],
  municipality = "Salvador",
): Promise<SchoolDirectoryEntry[]> {
  const { data, error } = await supabase.rpc("school_directory_search", {
    _search: search,
    _network_type: networkType ?? null,
    _municipality: municipality,
  });
  if (error) throw error;
  return (data ?? []) as SchoolDirectoryEntry[];
}

export async function ensureAccountOnboardingForSchool(
  requestedRole: "student" | "teacher",
  schoolDirectoryId: string,
): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc("ensure_account_onboarding_v2", {
    _requested_role: requestedRole,
    _school_directory_id: schoolDirectoryId,
  });
  if (error) throw error;
  return data as OnboardingState;
}

export async function ensureAccountOnboarding(requestedRole?: "student" | "teacher"): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc("ensure_account_onboarding", {
    _requested_role: requestedRole ?? null,
  });
  if (error) throw error;
  return data as OnboardingState;
}

export async function getAccountOnboardingState(): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc("account_get_onboarding_state");
  if (error) throw error;
  return data as OnboardingState;
}

export async function resubmitRoleRequest(role: "student" | "teacher"): Promise<boolean> {
  const { data, error } = await supabase.rpc("account_resubmit_role_request", {
    _requested_role: role,
  });
  if (error) throw error;
  return data ?? false;
}

export type AccountRoleRequest = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  requested_role: "student" | "teacher";
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  school_directory_id?: string | null;
  school_name?: string | null;
  school_network_type?: string | null;
};

export async function loadAccountRoleRequests(): Promise<AccountRoleRequest[]> {
  const { data, error } = await supabase.rpc("admin_list_role_requests_v2");
  if (error) throw error;
  return (data ?? []) as AccountRoleRequest[];
}

export async function reviewAccountRoleRequest(
  requestId: string,
  decision: "approved" | "rejected",
  approvedRole: "student" | "teacher",
  note: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("admin_review_role_request_v2", {
    _request_id: requestId,
    _decision: decision,
    _approved_role: approvedRole,
    _note: note,
  });
  if (error) throw error;
  return data ?? false;
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
  const role = await getRole();
  const { data, error } = role === "teacher"
    ? await supabase.rpc("teacher_list_grades", { _student_id: studentId })
    : await supabase.rpc("student_list_grades");
  if (error) throw error;
  return (data ?? []) as Grade[];
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

export type AdminStudentClassroom = { id: string; user_id: string; full_name: string; enrollment: string | null; classroom_id: string | null; classroom_name: string | null; status: string };
export async function loadAdminStudents(): Promise<AdminStudentClassroom[]> { const {data,error}=await supabase.rpc("admin_list_students"); if(error) throw error; return (data??[]) as AdminStudentClassroom[]; }
export async function adminAssignStudentToClassroom(studentId:string,classroomId:string,enrollment:string) { const {data,error}=await supabase.rpc("admin_assign_student_to_classroom",{_student_id:studentId,_classroom_id:classroomId,_enrollment:enrollment||null}); if(error) throw error; return data??false; }
export async function adminRemoveStudentFromClassroom(studentId:string) { const {data,error}=await supabase.rpc("admin_remove_student_from_classroom",{_student_id:studentId}); if(error) throw error; return data??false; }

export type AdminTeacherAssignment = { classroom_id: string; classroom_name: string; teacher_id: string; teacher_name: string; teacher_email: string };
export type AdminTeacher = { user_id: string; display_name: string; email: string };

export async function loadAdminTeacherAssignments(): Promise<AdminTeacherAssignment[]> {
  const { data, error } = await supabase.rpc("admin_list_teacher_classroom_assignments");
  if (error) throw error;
  return (data ?? []) as AdminTeacherAssignment[];
}

export async function loadAdminInstitutionTeachers(): Promise<AdminTeacher[]> {
  const { data, error } = await supabase.rpc("admin_list_institution_teachers");
  if (error) throw error;
  return (data ?? []) as AdminTeacher[];
}

export async function adminAssignTeacherToClassroom(teacherId: string, classroomId: string) {
  const { data, error } = await supabase.rpc("admin_assign_teacher_to_classroom", { _teacher_id: teacherId, _classroom_id: classroomId });
  if (error) throw error;
  return data ?? false;
}

export async function adminUnassignTeacherFromClassroom(teacherId: string, classroomId: string) {
  const { data, error } = await supabase.rpc("admin_unassign_teacher_from_classroom", { _teacher_id: teacherId, _classroom_id: classroomId });
  if (error) throw error;
  return data ?? false;
}

export type AdminAcademicSetup = {
  classrooms: { id: string; name: string; code: string | null; status: string }[];
  subjects: { id: string; name: string; code: string | null; status: string }[];
  terms: { id: string; name: string; starts_at: string | null; ends_at: string | null; is_current: boolean }[];
};

export async function createTeacherClassroom(name: string, code: string) {
  const { data, error } = await supabase.rpc("teacher_create_classroom", { _name: name, _code: code });
  if (error) throw error;
  return data;
}

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

export type TeacherSubject = { id: string; name: string; code: string | null; status: string; created_by: string | null };

export type TeacherSubjectAssignment = { id: string; classroom_id: string; classroom_name: string; subject_id: string; subject_name: string; teacher_id: string };
export type StudentSubject = { id: string; name: string; code: string | null; classroom_id: string; classroom_name: string; teacher_id: string; teacher_name: string };

export async function loadTeacherSubjectAssignments(): Promise<TeacherSubjectAssignment[]> {
  const { data, error } = await supabase.rpc("teacher_list_subject_assignments");
  if (error) throw error;
  return (data ?? []) as TeacherSubjectAssignment[];
}
export async function assignTeacherSubjectToClass(subjectId: string, classroomId: string) {
  const { data, error } = await supabase.rpc("teacher_assign_subject_to_class", { _subject_id: subjectId, _classroom_id: classroomId });
  if (error) throw error;
  return data;
}
export async function unassignTeacherSubjectFromClass(id: string) {
  const { data, error } = await supabase.rpc("teacher_unassign_subject_from_class", { _id: id });
  if (error) throw error;
  return data ?? false;
}
export async function loadStudentSubjects(): Promise<StudentSubject[]> {
  const { data, error } = await supabase.rpc("student_list_subjects");
  if (error) throw error;
  return (data ?? []) as StudentSubject[];
}

export async function loadTeacherSubjects(): Promise<TeacherSubject[]> {
  const { data, error } = await supabase.rpc("teacher_list_subjects");
  if (error) throw error;
  return (data ?? []) as TeacherSubject[];
}

export async function createTeacherSubject(name: string, code: string) {
  const { data, error } = await supabase.rpc("teacher_create_subject", { _name: name, _code: code });
  if (error) throw error;
  return data;
}

export async function updateTeacherSubject(id: string, name: string, code: string) {
  const { data, error } = await supabase.rpc("teacher_update_subject", { _id: id, _name: name, _code: code });
  if (error) throw error;
  return data ?? false;
}

export async function archiveTeacherSubject(id: string) {
  const { data, error } = await supabase.rpc("teacher_archive_subject", { _id: id });
  if (error) throw error;
  return data ?? false;
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

