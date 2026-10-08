import { supabase } from "@/integrations/supabase/client";
import { academicRpcClient } from "@/lib/academic-rpc-contracts";
import type { Tables, Json } from "@/integrations/supabase/types";
export type Student = Tables<"students">;
export type Grade = Tables<"grades">;
export type TeacherTask = Tables<"tasks">;
export type TeacherAnnouncement = Tables<"announcements">;
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
    // Student registration is never subject to approval. The requested role
    // is stored in auth metadata during signup, so a confirmed student can be
    // activated even if the role row was not persisted during onboarding.
    const requestedRole = auth.user.user_metadata?.["requested_role"];
    if (requestedRole === "student") {
      await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("user_id", auth.user.id);
    } else {
      throw new Error("Sua conta está aguardando aprovação do administrador.");
    }
  }
  if (profile.status === "suspended") {
    throw new Error("Sua conta está suspensa. Procure o administrador da instituição.");
  }

  // Resolve the role from the active institution, not from the global role table.
  // A user can belong to more than one institution and must not inherit another
  // institution's role while switching the active context.
  const { data: institutions, error: institutionError } = await supabase.rpc("account_list_institutions");
  if (institutionError) throw institutionError;

  // When legacy data leaves more than one role in the active institution,
  // always resolve the strongest role first. This prevents an admin account
  // with a stale student membership from being sent to the student dashboard.
  let activeInstitutions = (institutions ?? []).filter((item) => item.is_active);

  // A freshly approved account can have a valid institutional membership but no
  // persisted active context yet. Establish it automatically when there is only
  // one possible institution; otherwise the teacher/admin RPCs have no tenant
  // context and the academic area can appear empty or fail.
  if (activeInstitutions.length === 0 && (institutions ?? []).length === 1) {
    const institutionId = institutions?.[0]?.id;
    if (!institutionId) throw new Error("Instituição não encontrada.");
    const { error: contextError } = await supabase.rpc("account_set_institution", {
      _institution_id: institutionId,
    });
    if (contextError) throw contextError;
    activeInstitutions = (institutions ?? []).map((item) => ({ ...item, is_active: true }));
  }

  // Never infer a role from an arbitrary institution when a multi-school
  // account has no active context. Doing so could open the wrong academic
  // panel or expose data from another institution. A single institution is
  // safe to select automatically; multiple institutions must have an explicit
  // active context selected by the account.
  if (activeInstitutions.length > 0) {
    const activeRole =
      (activeInstitutions.find((item) => item.role === "admin")?.role ??
        activeInstitutions.find((item) => item.role === "teacher")?.role ??
        activeInstitutions.find((item) => item.role === "student")?.role) as UserRole | undefined;
    if (activeRole === "admin" || activeRole === "teacher" || activeRole === "student") {
      return activeRole;
    }
  }

  if ((institutions ?? []).length > 1) {
    throw new Error("Selecione a instituição ativa para continuar.");
  }

  // Student registration is intentionally independent from academic linkage.
  // A student can have a valid student role before an institution/classroom
  // membership exists. Teachers and admins still require institutional context.
  const { data: globalStudentRole, error: globalStudentRoleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "student")
    .maybeSingle();

  if (globalStudentRoleError) throw globalStudentRoleError;
  if (globalStudentRole?.role === "student") return "student";

  // Final fallback for a student account whose role row was not persisted.
  // Admins/teachers are already resolved above, so an active profile with no
  // academic role can safely be treated as an unlinked student. This keeps
  // email-confirmed students out of the approval flow while their school,
  // classroom and academic records are still pending.
  const requestedRole = auth.user.user_metadata?.["requested_role"];
  if (requestedRole === "student" || profile.status === "active") {
    return "student";
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
    ...(networkType ? { _network_type: networkType } : {}),
    _municipality: municipality,
  });
  if (error) throw error;
  return (data ?? []) as SchoolDirectoryEntry[];
}

export async function ensureAccountOnboardingForSchool(
  requestedRole: "student" | "teacher",
  schoolDirectoryId: string | null,
): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc("ensure_account_onboarding_v2", {
    _requested_role: requestedRole,
    _school_directory_id: schoolDirectoryId as string,
  });
  if (error) throw error;
  return data as OnboardingState;
}

export async function ensureAccountOnboarding(requestedRole?: "student" | "teacher"): Promise<OnboardingState> {
  const { data, error } = await supabase.rpc("ensure_account_onboarding", {
    ...(requestedRole ? { _requested_role: requestedRole } : {}),
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
  // Use the institution-aware approval flow so the selected school is
  // respected. The legacy RPC could approve into the default SINA tenant.
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

export type TeacherInstitutionStudent = TeacherStudent & {
  class_status: "sem_turma" | "minha_turma" | "outra_turma";
};

export async function loadStudents(): Promise<TeacherStudent[]> {
  const { data, error } = await supabase.rpc("teacher_list_roster");
  if (error) throw error;
  return data ?? [];
}

export async function loadTeacherInstitutionStudents(): Promise<TeacherInstitutionStudent[]> {
  const { data, error } = await supabase.rpc("teacher_list_institution_students");
  if (error) throw error;
  return (data ?? []) as TeacherInstitutionStudent[];
}

export async function loadTeacherInstitutionStudentsPage(
  search = "",
  classStatus = "",
  page = 1,
  pageSize = 25,
): Promise<PaginatedResult<TeacherInstitutionStudent>> {
  const { data, error } = await supabase.rpc("teacher_list_institution_students_page", {
    _search: search,
    _class_status: classStatus,
    _page: page,
    _page_size: pageSize,
  });
  if (error) throw error;
  const result = (data ?? {}) as Partial<PaginatedResult<TeacherInstitutionStudent>>;
  return {
    items: Array.isArray(result.items) ? result.items as TeacherInstitutionStudent[] : [],
    total: Number(result.total ?? 0),
    page: Number(result.page ?? page),
    page_size: Number(result.page_size ?? pageSize),
  };
}

export async function teacherRemoveStudentFromClassroom(studentId: string) {
  const { data, error } = await supabase.rpc("teacher_remove_student_from_classroom", {
    _student_id: studentId,
  });
  if (error) throw error;
  return data ?? false;
}

export async function loadMyStudent(): Promise<Student | null> {
  // Academic linkage is optional immediately after student registration.
  // Do not call student RPCs that require an active institution until the
  // account has at least one institutional membership.
  const { data: institutions, error: institutionError } = await supabase.rpc("account_list_institutions");
  if (institutionError) throw institutionError;
  if (!(institutions ?? []).length) return null;

  const { data, error } = await supabase.rpc("student_get_profile");
  if (error) throw error;

  let student = data?.[0] ?? null;

  if (!student) {
    // A criação é feita apenas quando o perfil ainda não existe.
    // Isso evita writes repetidos durante a atualização automática do dashboard.
    const { error: ensureError } = await supabase.rpc("ensure_student_profile");
    if (ensureError) throw ensureError;

    const { data: refreshed, error: refreshError } = await supabase.rpc("student_get_profile");
    if (refreshError) throw refreshError;
    student = refreshed?.[0] ?? null;
  }

  if (!student) return null;

  // Quando o aluno entra com Google, o Supabase Auth normalmente recebe a foto
  // em user_metadata.avatar_url ou user_metadata.picture. Se o aluno ainda não
  // escolheu uma foto própria no SINA, aproveitamos essa imagem automaticamente.
  if (!student.avatar_url) {
    const { data: auth } = await supabase.auth.getUser();
    const metadata = auth.user?.user_metadata ?? {};
    const googleAvatar =
      typeof metadata["avatar_url"] === "string"
        ? metadata["avatar_url"]
        : typeof metadata["picture"] === "string"
          ? metadata["picture"]
          : null;

    if (googleAvatar) {
      const { data: updated, error: updateError } = await supabase.rpc("student_update_profile", {
        _full_name: student.full_name,
        _avatar_url: googleAvatar,
      });

      if (!updateError && updated) {
        student = updated as Student;
      }
    }
  }

  return student;
}
export async function loadGrades(studentId: string): Promise<Grade[]> {
  const { data, error } = await supabase.rpc("student_list_grades");
  if (error) throw error;
  return (data ?? []) as Grade[];
}

export async function loadTeacherGrades(studentId: string): Promise<Grade[]> {
  const { data, error } = await supabase.rpc("teacher_list_grades", { _student_id: studentId });
  if (error) throw error;
  return (data ?? []) as Grade[];
}

export type TeacherGradebookRow = {
  student_id: string;
  full_name: string;
  enrollment: string;
  score: number | null;
  absences: number;
  updated_at: string;
};

export async function loadTeacherGradebook(
  classroomId: string,
  subjectId: string,
  period: number,
): Promise<TeacherGradebookRow[]> {
  const { data, error } = await supabase.rpc("teacher_get_gradebook", {
    _classroom_id: classroomId,
    _subject_id: subjectId,
    _period: period,
  });
  if (error) throw error;
  return (data ?? []) as TeacherGradebookRow[];
}

export async function saveTeacherGradebook(args: {
  classroomId: string;
  subjectId: string;
  period: number;
  rows: Array<{ student_id: string; score: number; absences: number }>;
}): Promise<number> {
  const { data, error } = await supabase.rpc("teacher_bulk_upsert_grades_v2", {
    _classroom_id: args.classroomId,
    _subject_id: args.subjectId,
    _period: args.period,
    _rows: args.rows,
  });
  if (error) throw error;
  return data ?? 0;
}

export async function clearTeacherGradebookScores(args: {
  classroomId: string;
  subjectId: string;
  period: number;
  rows: Array<{ student_id: string; absences: number }>;
}): Promise<number> {
  if (!args.rows.length) return 0;
  const { data, error } = await academicRpcClient.rpc("teacher_clear_gradebook_scores", {
    _classroom_id: args.classroomId,
    _subject_id: args.subjectId,
    _period: args.period,
    _rows: args.rows,
  });
  if (error) throw error;
  return data ?? 0;
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

export type StudentTaskDetailed = StudentTask & {
  classroom_id: string;
  classroom_name: string;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string;
  teacher_name: string;
};

export type StudentAssessmentDetailed = StudentAssessment & {
  classroom_id: string;
  classroom_name: string;
  subject_id: string | null;
  teacher_id: string;
  teacher_name: string;
};

export type AcademicMaterialDetailed = AcademicMaterial & {
  teacher_id: string;
  teacher_name: string;
};

export type StudentAnnouncementDetailed = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  classroom_id: string;
  classroom_name: string;
  title: string;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
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

export async function loadDashboardAnnouncements(): Promise<StudentAnnouncement[]> {
  const { data, error } = await supabase.rpc("student_list_announcements");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Tables<"announcements">[]);
}

export async function loadDashboardTasks(): Promise<StudentTask[]> {
  const { data, error } = await supabase.rpc("student_list_tasks");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Omit<StudentTask, "attachment_url" | "completed">[]).then(
    (items) => items.map((item) => ({
      ...item,
      completed: (data ?? []).find((task) => task.id === item.id)?.completed ?? false,
    })) as StudentTask[],
  );
}

export async function loadAnnouncements(): Promise<StudentAnnouncement[]> {
  const { data, error } = await supabase.rpc("student_list_announcements");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Tables<"announcements">[]);
}

export async function loadStudentAnnouncementsDetailed(): Promise<StudentAnnouncementDetailed[]> {
  const { data, error } = await supabase.rpc("student_list_announcements_detailed");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Omit<StudentAnnouncementDetailed, "attachment_url">[]);
}

export async function loadTasks(): Promise<StudentTask[]> {
  const { data, error } = await supabase.rpc("student_list_tasks");
  if (error) throw error;
  return addAttachmentUrls((data ?? []) as Omit<StudentTask, "attachment_url" | "completed">[]).then(
    (items) => items.map((item) => ({ ...item, completed: (data ?? []).find((task) => task.id === item.id)?.completed ?? false })),
  ) as Promise<StudentTask[]>;
}

export async function loadStudentTasksDetailed(): Promise<StudentTaskDetailed[]> {
  const { data, error } = await supabase.rpc("student_list_tasks_detailed");
  if (error) throw error;
  return addAttachmentUrls((data ?? []).map((item) => ({
    ...item,
    classroom: item.classroom_name,
    subject: item.subject_name ?? "",
  })) as Omit<StudentTaskDetailed, "attachment_url">[]);
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
  metadata: Json;
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

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase.rpc("student_mark_all_notifications_read");
  if (error) throw error;
  return data ?? 0;
}

export type TeacherClassroom = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  student_count: number;
};

export type TeacherInstitutionClassroom = TeacherClassroom & {
  teacher_count: number;
  is_linked: boolean;
};

export type AttendanceRow = {
  student_id: string;
  full_name: string;
  enrollment: string;
  status: "present" | "absent" | "late" | "excused";
  note: string;
  subject_id?: string | null;
  subject_name?: string | null;
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
  attachment_name?: string | null;
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

export type AdminStudentClassroom = { id: string; user_id: string; full_name: string; enrollment: string | null; avatar_url: string | null; classroom_id: string | null; classroom_name: string | null; status: string };
export type PaginatedResult<T> = { items: T[]; total: number; page: number; page_size: number };

export async function loadAdminStudentsPage(
  search = "",
  onlyWithoutClass = false,
  page = 1,
  pageSize = 25,
): Promise<PaginatedResult<AdminStudentClassroom>> {
  const { data, error } = await supabase.rpc("admin_list_students_page", {
    _search: search,
    _only_without_class: onlyWithoutClass,
    _page: page,
    _page_size: pageSize,
  });
  if (error) throw error;
  const result = (data ?? {}) as Partial<PaginatedResult<AdminStudentClassroom>>;
  return {
    items: Array.isArray(result.items) ? result.items as AdminStudentClassroom[] : [],
    total: Number(result.total ?? 0),
    page: Number(result.page ?? page),
    page_size: Number(result.page_size ?? pageSize),
  };
}
export async function adminUpdateStudentProfile(
  studentId: string,
  fullName: string,
  enrollment: string,
  avatarUrl: string | null,
) {
  const { data, error } = await supabase.rpc("admin_update_student_profile", {
    _student_id: studentId,
    _full_name: fullName,
    _enrollment: enrollment || undefined,
    _avatar_url: avatarUrl ?? "",
  });
  if (error) throw error;
  return data;
}
export async function adminUpdateProfile(userId: string, displayName: string, avatarUrl: string | null) {
  const { data, error } = await supabase.rpc("admin_update_profile", {
    _user_id: userId,
    _display_name: displayName,
    _avatar_url: avatarUrl ?? "",
  });
  if (error) throw error;
  return data;
}


export async function adminAssignStudentToClassroom(studentId:string,classroomId:string,enrollment:string) { const {data,error}=await supabase.rpc("admin_assign_student_to_classroom",{_student_id:studentId,_classroom_id:classroomId,...(enrollment ? {_enrollment:enrollment} : {})}); if(error) throw error; return data??false; }
export async function adminRemoveStudentFromClassroom(studentId:string) { const {data,error}=await supabase.rpc("admin_remove_student_from_classroom",{_student_id:studentId}); if(error) throw error; return data??false; }

export type AdminStudentSchoolLink = {
  id: string;
  user_id: string;
  full_name: string;
  enrollment: string | null;
  institution_id: string | null;
  institution_name: string | null;
  classroom_id: string | null;
  classroom_name: string | null;
  status: "sem_escola" | "vinculado";
};

export async function loadAdminStudentSchoolLinks(): Promise<AdminStudentSchoolLink[]> {
  const { data, error } = await supabase.rpc("admin_list_student_school_links");
  if (error) throw error;
  return (data ?? []) as AdminStudentSchoolLink[];
}

export async function adminLinkStudentToInstitution(studentId: string, institutionId: string) {
  const { data, error } = await supabase.rpc("admin_link_student_to_institution", {
    _student_id: studentId,
    _institution_id: institutionId,
  });
  if (error) throw error;
  return data ?? false;
}

export type TeacherUnassignedStudent = {
  id: string;
  user_id: string;
  full_name: string;
  enrollment: string | null;
  institution_id: string | null;
  institution_name: string | null;
  classroom_id: string | null;
  classroom_name: string | null;
  status: "sem_escola";
};

export async function loadTeacherUnassignedStudents(): Promise<TeacherUnassignedStudent[]> {
  const { data, error } = await supabase.rpc("teacher_list_unassigned_students");
  if (error) throw error;
  return (data ?? []) as TeacherUnassignedStudent[];
}

export async function teacherLinkStudentToSchool(studentId: string) {
  const { data, error } = await supabase.rpc("teacher_link_student_to_school", {
    _student_id: studentId,
  });
  if (error) throw error;
  return data ?? false;
}

export async function teacherEnrollStudentInClassroom(
  studentId: string,
  classroomId: string,
  enrollment: string,
) {
  const { data, error } = await supabase.rpc("teacher_enroll_student_in_classroom", {
    _student_id: studentId,
    _classroom_id: classroomId as string,
    _enrollment: enrollment,
  });
  if (error) throw error;
  return data ?? false;
}

export type AdminLinkableInstitution = {
  id: string;
  name: string;
  slug: string;
  status: string;
  school_directory_id: string | null;
};

export async function loadAdminLinkableInstitutions(): Promise<AdminLinkableInstitution[]> {
  const { data, error } = await supabase.rpc("admin_list_linkable_institutions");
  if (error) throw error;
  return (data ?? []) as AdminLinkableInstitution[];
}

export type AdminTeacherSchoolLink = { user_id: string; display_name: string; email: string; avatar_url?: string | null; institution_id: string | null; institution_name: string | null; school_count: number };

export async function loadAdminTeacherSchoolLinks(): Promise<AdminTeacherSchoolLink[]> {
  const { data, error } = await supabase.rpc("admin_list_teacher_school_links");
  if (error) throw error;
  return (data ?? []) as AdminTeacherSchoolLink[];
}

export async function adminLinkTeacherToInstitution(teacherId: string, institutionId: string) {
  const { data, error } = await supabase.rpc("admin_link_teacher_to_institution", {
    _teacher_id: teacherId,
    _institution_id: institutionId,
  });
  if (error) throw error;
  return data ?? false;
}

export type AdminTeacherAssignment = { classroom_id: string; classroom_name: string; teacher_id: string; teacher_name: string; teacher_email: string };
export type AdminTeacher = { user_id: string; display_name: string; email: string };

export type AdminSubjectTeacherMatrixEntry = {
  id: string;
  classroom_id: string;
  classroom_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string;
  teacher_email: string | null;
  is_primary: boolean;
  teacher_count: number;
};

export async function loadAdminSubjectTeacherMatrix(): Promise<AdminSubjectTeacherMatrixEntry[]> {
  const { data, error } = await academicRpcClient.rpc("admin_list_subject_teacher_matrix");
  if (error) throw error;
  return (data ?? []) as AdminSubjectTeacherMatrixEntry[];
}

export async function adminSetSubjectResponsible(
  classroomId: string,
  subjectId: string,
  teacherId: string | null,
) {
  const { data, error } = await academicRpcClient.rpc("admin_set_subject_responsible", {
    _classroom_id: classroomId,
    _subject_id: subjectId,
    _teacher_id: teacherId,
  });
  if (error) throw error;
  return data ?? false;
}

export async function adminSetSubjectTeacherLink(
  classroomId: string,
  subjectId: string,
  teacherId: string,
  isPrimary = false,
) {
  const { data, error } = await academicRpcClient.rpc("admin_set_subject_teacher_link", {
    _classroom_id: classroomId,
    _subject_id: subjectId,
    _teacher_id: teacherId,
    _is_primary: isPrimary,
  });
  if (error) throw error;
  return data ?? false;
}

export async function adminRemoveSubjectTeacherLink(
  classroomId: string,
  subjectId: string,
  teacherId: string,
) {
  const { data, error } = await academicRpcClient.rpc("admin_remove_subject_teacher_link", {
    _classroom_id: classroomId,
    _subject_id: subjectId,
    _teacher_id: teacherId,
  });
  if (error) throw error;
  return data ?? false;
}

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
  classrooms: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    student_count: number;
    teacher_count: number;
    subject_count: number;
    task_count: number;
    assessment_count: number;
    attendance_count: number;
  }[];
  subjects: { id: string; name: string; code: string | null; status: string }[];
  terms: { id: string; name: string; starts_at: string | null; ends_at: string | null; is_current: boolean }[];
  matrix: {
    id: string;
    classroom_id: string;
    classroom_name: string;
    classroom_status: string;
    subject_id: string;
    subject_name: string;
    subject_code: string | null;
    teacher_id: string | null;
    teacher_name: string;
    student_count: number;
    task_count: number;
    assessment_count: number;
    attendance_count: number;
  }[];
  quality: {
    students_without_class: number;
    classrooms_without_teacher: { id: string; name: string }[];
    classrooms_without_subject: { id: string; name: string }[];
    subject_links_without_teacher: { id: string; classroom_name: string; subject_name: string }[];
    tasks_without_subject: number;
    attendance_without_subject: number;
  };
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

export async function loadTeacherInstitutionClassrooms(): Promise<TeacherInstitutionClassroom[]> {
  const { data, error } = await supabase.rpc("teacher_list_institution_classrooms");
  if (error) throw error;
  return (data ?? []) as TeacherInstitutionClassroom[];
}

export async function teacherJoinClassroom(classroomId: string) {
  const { data, error } = await supabase.rpc("teacher_join_classroom", { _classroom_id: classroomId });
  if (error) throw error;
  return data ?? false;
}

export async function teacherLeaveClassroom(classroomId: string) {
  const { data, error } = await supabase.rpc("teacher_leave_classroom", { _classroom_id: classroomId });
  if (error) throw error;
  return data ?? false;
}

export async function loadTeacherUnassignedClassrooms(): Promise<TeacherClassroom[]> {
  const { data, error } = await supabase.rpc("teacher_list_unassigned_classrooms");
  if (error) throw error;
  return (data ?? []) as TeacherClassroom[];
}

export async function teacherClaimClassroom(classroomId: string) {
  const { data, error } = await supabase.rpc("teacher_claim_classroom", { _classroom_id: classroomId });
  if (error) throw error;
  return data ?? false;
}

export async function loadAttendance(classroomId: string, date: string, subjectId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.rpc("teacher_get_attendance", {
    _classroom_id: classroomId ?? undefined,
    _date: date,
    _subject_id: subjectId,
  });
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function saveAttendance(classroomId: string, date: string, subjectId: string, rows: Pick<AttendanceRow, "student_id" | "status" | "note">[]): Promise<number> {
  const { data, error } = await supabase.rpc("teacher_save_attendance", {
    _classroom_id: classroomId,
    _date: date,
    _subject_id: subjectId,
    _rows: rows,
  });
  if (error) throw error;
  return data ?? 0;
}

export type TeacherAttendanceReportRow = {
  student_id: string;
  student_name: string;
  enrollment: string;
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percent: number | null;
  last_attendance_date: string | null;
};

export async function loadTeacherAttendanceReport(
  classroomId: string,
  subjectId: string,
): Promise<TeacherAttendanceReportRow[]> {
  const { data, error } = await supabase.rpc("teacher_get_attendance_report", {
    _classroom_id: classroomId,
    _subject_id: subjectId,
  });
  if (error) throw error;
  return (data ?? []) as TeacherAttendanceReportRow[];
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

export async function deleteTeacherSubject(id: string) {
  const { data, error } = await supabase.rpc("teacher_delete_subject", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function deleteAdminSubject(id: string) {
  const { data, error } = await supabase.rpc("admin_delete_subject", { _id: id });
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
    _subject_id: args.subjectId as string,
    _term_id: args.termId as string,
    _title: args.title,
    _type: args.type,
    _weight: args.weight,
    _max_score: args.maxScore,
    _due_at: args.dueAt as string,
  });
  if (error) throw error;
  return data;
}

export async function loadStudentAssessments(): Promise<StudentAssessment[]> {
  const { data, error } = await supabase.rpc("student_list_assessments");
  if (error) throw error;
  return (data ?? []) as StudentAssessment[];
}

export async function loadStudentAssessmentsDetailed(): Promise<StudentAssessmentDetailed[]> {
  const { data, error } = await supabase.rpc("student_list_assessments_detailed");
  if (error) throw error;
  return (data ?? []) as StudentAssessmentDetailed[];
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
    _score: score as number,
    _feedback: feedback,
  });
  if (error) throw error;
  return data ?? false;
}

export async function updateTeacherTask(args: {
  id: string; classroom: string; subject: string; title: string; description: string; dueAt: string | null;
  attachmentPath?: string | null; attachmentName?: string | null; attachmentSize?: number | null; attachmentType?: string | null;
}) {
  const { data, error } = await supabase.rpc("teacher_update_task", {
    _id: args.id,
    _classroom: args.classroom,
    _subject: args.subject,
    _title: args.title,
    _description: args.description,
    ...(args.dueAt ? { _due_at: args.dueAt } : {}),
    ...(args.attachmentPath ? { _attachment_path: args.attachmentPath } : {}),
    ...(args.attachmentName ? { _attachment_name: args.attachmentName } : {}),
    ...(args.attachmentSize != null ? { _attachment_size: args.attachmentSize } : {}),
    ...(args.attachmentType ? { _attachment_type: args.attachmentType } : {}),
  });
  if (error) throw error;
  return data;
}

export async function deleteTeacherTask(id: string) {
  const { data, error } = await supabase.rpc("teacher_delete_task", { _id: id });
  if (error) throw error;
  return data;
}

export async function updateTeacherAnnouncement(args: {
  id: string; classroom: string; title: string; content: string;
  attachmentPath?: string | null; attachmentName?: string | null; attachmentSize?: number | null; attachmentType?: string | null;
}) {
  const { data, error } = await supabase.rpc("teacher_update_announcement", {
    _id: args.id,
    _classroom: args.classroom,
    _title: args.title,
    _content: args.content,
    ...(args.attachmentPath ? { _attachment_path: args.attachmentPath } : {}),
    ...(args.attachmentName ? { _attachment_name: args.attachmentName } : {}),
    ...(args.attachmentSize != null ? { _attachment_size: args.attachmentSize } : {}),
    ...(args.attachmentType ? { _attachment_type: args.attachmentType } : {}),
  });
  if (error) throw error;
  return data;
}

export async function deleteTeacherAnnouncement(id: string) {
  const { data, error } = await supabase.rpc("teacher_delete_announcement", { _id: id });
  if (error) throw error;
  return data;
}

export type StudentAttendanceDetailed = {
  attendance_date: string;
  status: string;
  note: string | null;
  classroom_id: string;
  classroom_name: string;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string;
  teacher_name: string;
};

export async function loadStudentAttendance(): Promise<{ attendance_date: string; status: string; note: string | null; classroom: string }[]> {
  const { data, error } = await supabase.rpc("student_list_attendance", { _limit: 90 });
  if (error) throw error;
  return data ?? [];
}

export async function loadStudentAttendanceDetailed(): Promise<StudentAttendanceDetailed[]> {
  const { data, error } = await supabase.rpc("student_list_attendance_detailed", { _limit: 180 });
  if (error) throw error;
  return (data ?? []) as StudentAttendanceDetailed[];
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
    _classroom_id: args.classroomId as string,
    _title: args.title,
    _description: args.description,
    _start_at: args.startAt,
    _end_at: args.endAt as string,
    _event_type: args.eventType,
  });
  if (error) throw error;
  return data;
}

export async function updateTeacherCalendarEvent(args: {
  id: string;
  classroomId: string | null;
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  eventType: string;
}) {
  const { data, error } = await supabase.rpc("teacher_update_calendar_event", {
    _id: args.id,
    _classroom_id: args.classroomId as string,
    _title: args.title,
    _description: args.description,
    _start_at: args.startAt,
    _end_at: args.endAt as string,
    _event_type: args.eventType,
  });
  if (error) throw error;
  return data;
}

export async function deleteTeacherCalendarEvent(id: string) {
  const { data, error } = await supabase.rpc("teacher_delete_calendar_event", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export type TeacherClassReport = {
  student_id: string;
  student_name: string;
  enrollment: string;
  attendance_percent: number | null;
  grade_average: number;
  assessment_count: number;
};

export type AcademicMaterial = {
  id: string;
  classroom_id: string;
  classroom_name: string;
  subject_id: string | null;
  subject_name: string | null;
  term_id: string | null;
  term_name: string | null;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
  updated_at?: string;
  file_url?: string | null;
};

export type AcademicAttachment = {
  path: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

const ACADEMIC_ATTACHMENT_BUCKET = "academic-attachments";
const MAX_ACADEMIC_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_ACADEMIC_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function uploadAcademicAttachment(file: File, folder: "tasks" | "announcements" | "materials"): Promise<AcademicAttachment> {
  if (!ALLOWED_ACADEMIC_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Envie PDF, imagem, Word, PowerPoint, Excel ou TXT.");
  }
  if (file.size <= 0 || file.size > MAX_ACADEMIC_ATTACHMENT_SIZE) {
    throw new Error("O arquivo deve ter entre 1 byte e 20 MB.");
  }

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "arquivo";
  const path = `${auth.user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(ACADEMIC_ATTACHMENT_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;

  const { data: signed, error: signedError } = await supabase.storage
    .from(ACADEMIC_ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Não foi possível gerar o link do arquivo.");
  return { path, name: file.name, size: file.size, type: file.type, url: signed.signedUrl };
}

export async function loadTeacherAcademicMaterials(): Promise<AcademicMaterial[]> {
  const { data, error } = await supabase.rpc("teacher_list_academic_materials");
  if (error) throw error;
  const items = (data ?? []) as AcademicMaterial[];
  return Promise.all(items.map(async item => {
    const { data: signed } = await supabase.storage.from(ACADEMIC_ATTACHMENT_BUCKET).createSignedUrl(item.file_path, 60 * 60);
    return { ...item, file_url: signed?.signedUrl ?? null };
  }));
}

export async function createTeacherAcademicMaterial(args: {
  classroomId: string;
  subjectId: string | null;
  termId: string | null;
  title: string;
  description: string;
  attachment: Pick<AcademicAttachment, "path" | "name" | "size" | "type">;
}) {
  const { data, error } = await supabase.rpc("teacher_create_academic_material", {
    _classroom_id: args.classroomId,
    _subject_id: args.subjectId as string,
    _term_id: args.termId as string,
    _title: args.title,
    _description: args.description,
    _file_path: args.attachment.path,
    _file_name: args.attachment.name,
    _file_size: args.attachment.size,
    _file_type: args.attachment.type,
  });
  if (error) throw error;
  return data;
}

export async function deleteTeacherAcademicMaterial(id: string) {
  const { data, error } = await supabase.rpc("teacher_delete_academic_material", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function loadStudentAcademicMaterials(): Promise<AcademicMaterial[]> {
  const { data, error } = await supabase.rpc("student_list_academic_materials");
  if (error) throw error;
  const items = (data ?? []) as AcademicMaterial[];
  return Promise.all(items.map(async item => {
    const { data: signed } = await supabase.storage.from(ACADEMIC_ATTACHMENT_BUCKET).createSignedUrl(item.file_path, 60 * 60);
    return { ...item, file_url: signed?.signedUrl ?? null };
  }));
}

export async function loadStudentAcademicMaterialsDetailed(): Promise<AcademicMaterialDetailed[]> {
  const { data, error } = await supabase.rpc("student_list_academic_materials_detailed");
  if (error) throw error;
  const items = (data ?? []) as AcademicMaterialDetailed[];
  return Promise.all(items.map(async item => {
    const { data: signed } = await supabase.storage.from(ACADEMIC_ATTACHMENT_BUCKET).createSignedUrl(item.file_path, 60 * 60);
    return { ...item, file_url: signed?.signedUrl ?? null };
  }));
}

export async function createTeacherTask(args: {
  classroom: string;
  subject: string;
  title: string;
  description: string;
  dueAt?: string | null;
  attachment?: Pick<AcademicAttachment, "path" | "name" | "size" | "type"> | null;
}) {
  const { data, error } = await supabase.rpc("teacher_create_task", {
    _classroom: args.classroom,
    _subject: args.subject,
    _title: args.title,
    _description: args.description,
    ...(args.dueAt ? { _due_at: args.dueAt } : {}),
    ...(args.attachment ? {
      _attachment_path: args.attachment.path,
      _attachment_name: args.attachment.name,
      _attachment_size: args.attachment.size,
      _attachment_type: args.attachment.type,
    } : {}),
  });
  if (error) throw error;
  return data;
}

export async function createTeacherAnnouncement(args: {
  classroom: string;
  title: string;
  content: string;
  attachment?: Pick<AcademicAttachment, "path" | "name" | "size" | "type"> | null;
}) {
  const { data, error } = await supabase.rpc("teacher_create_announcement", {
    _classroom: args.classroom,
    _title: args.title,
    _content: args.content,
    ...(args.attachment ? {
      _attachment_path: args.attachment.path,
      _attachment_name: args.attachment.name,
      _attachment_size: args.attachment.size,
      _attachment_type: args.attachment.type,
    } : {}),
  });
  if (error) throw error;
  return data;
}

export async function loadTeacherTasks(): Promise<TeacherTask[]> {
  const { data, error } = await supabase.rpc("teacher_list_tasks");
  if (error) throw error;
  return (data ?? []) as TeacherTask[];
}

export async function loadTeacherAnnouncements(): Promise<TeacherAnnouncement[]> {
  const { data, error } = await supabase.rpc("teacher_list_announcements");
  if (error) throw error;
  return (data ?? []) as TeacherAnnouncement[];
}

export async function loadTeacherClassReport(classroomId: string): Promise<TeacherClassReport[]> {
  const { data, error } = await supabase.rpc("teacher_get_class_report", { _classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as TeacherClassReport[];
}

export type InstitutionInvitation = {
  id: string;
  email: string;
  role: "teacher" | "student";
  classroom_id: string | null;
  classroom_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function createAdminInstitutionInvitation(
  email: string,
  role: "teacher" | "student",
  classroomId: string | null,
  expiresHours = 72,
) {
  const rpcArgs: { _email: string; _role: string; _expires_hours: number; _classroom_id?: string } = {
    _email: email,
    _role: role,
    _expires_hours: expiresHours,
  };
  if (classroomId) rpcArgs._classroom_id = classroomId;

  const { data, error } = await supabase.rpc("admin_create_institution_invitation", rpcArgs);
  if (error) throw error;
  return (data?.[0] ?? null) as { invitation_id: string; token: string; expires_at: string } | null;
}

export async function loadAdminInstitutionInvitations(): Promise<InstitutionInvitation[]> {
  const { data, error } = await supabase.rpc("admin_list_institution_invitations");
  if (error) throw error;
  return (data ?? []) as InstitutionInvitation[];
}

export async function revokeAdminInstitutionInvitation(id: string) {
  const { data, error } = await supabase.rpc("admin_revoke_institution_invitation", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function acceptInstitutionInvitation(token: string) {
  const { data, error } = await supabase.rpc("accept_institution_invitation", { _token: token });
  if (error) throw error;
  return data?.[0] ?? null;
}

export type GradeChangeAuditEntry = {
  id: string;
  grade_id: string | null;
  student_id: string;
  student_name: string | null;
  subject_id: string | null;
  subject: string | null;
  period: number;
  action: "insert" | "update" | "delete";
  changed_by: string | null;
  changed_at: string;
  old_score: number | null;
  new_score: number | null;
  old_absences: number | null;
  new_absences: number | null;
};

export async function loadAdminGradeChangeAudit(limit = 50): Promise<GradeChangeAuditEntry[]> {
  const { data, error } = await academicRpcClient.rpc("admin_list_grade_change_audit", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as GradeChangeAuditEntry[];
}

export type AcademicPeriodLock = {
  period: number;
  is_closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
};

export async function loadTeacherGradebookPeriodStatus(period: number): Promise<AcademicPeriodLock> {
  const { data, error } = await academicRpcClient.rpc("teacher_get_gradebook_period_status", { _period: period });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { period, is_closed: false, closed_at: null, closed_by: null }) as AcademicPeriodLock;
}

export async function loadAdminAcademicPeriodLocks(): Promise<AcademicPeriodLock[]> {
  const { data, error } = await academicRpcClient.rpc("admin_list_academic_period_locks");
  if (error) throw error;
  return (data ?? []) as AcademicPeriodLock[];
}

export async function setAdminAcademicPeriodLock(period: number, closed: boolean): Promise<boolean> {
  const { data, error } = await academicRpcClient.rpc("admin_set_academic_period_lock", {
    _period: period,
    _closed: closed,
  });
  if (error) throw error;
  return data ?? false;
}

export async function loadAdminAcademicSetup(): Promise<AdminAcademicSetup> {
  const { data, error } = await supabase.rpc("admin_list_academic_setup");
  if (error) throw error;
  return (data ?? { classrooms: [], subjects: [], terms: [] }) as AdminAcademicSetup;
}

export async function adminImportAcademicCsv(rows: Record<string, string>[]) {
  const { data, error } = await supabase.rpc("admin_import_academic_csv", { _rows: rows });
  if (error) throw error;
  return (data ?? { classes: 0, students: 0, skipped: 0 }) as { classes: number; students: number; skipped: number };
}

export type AdminClassroomHub = {
  classroom: { id: string; name: string; code: string | null; status: string };
  students: { id: string; full_name: string; enrollment: string | null }[];
  teachers: { user_id: string; name: string }[];
  subjects: { id: string; name: string; code: string | null; teacher_id: string | null; teacher_name: string }[];
  metrics: {
    students: number;
    teachers: number;
    subject_links: number;
    grades: number;
    assessments: number;
    tasks: number;
    materials: number;
    attendance: number;
  };
};

export async function loadAdminClassroomHub(classroomId: string): Promise<AdminClassroomHub> {
  const { data, error } = await supabase.rpc("admin_get_classroom_hub", { _classroom_id: classroomId });
  if (error) throw error;
  return (data ?? {
    classroom: { id: classroomId, name: "", code: null, status: "unknown" },
    students: [], teachers: [], subjects: [],
    metrics: { students: 0, teachers: 0, subject_links: 0, grades: 0, assessments: 0, tasks: 0, materials: 0, attendance: 0 },
  }) as AdminClassroomHub;
}

export async function adminUpsertClassroom(id: string | null, name: string, code: string) {
  const { data, error } = await supabase.rpc("admin_upsert_classroom", { _id: id as string, _name: name, _code: code });
  if (error) throw error;
  return data;
}

export async function adminArchiveClassroom(id: string) {
  const { data, error } = await supabase.rpc("admin_archive_classroom", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function adminRestoreClassroom(id: string) {
  const { data, error } = await supabase.rpc("admin_restore_classroom", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function adminDeleteClassroom(id: string) {
  const { data, error } = await supabase.rpc("admin_delete_classroom", { _id: id });
  if (error) throw error;
  return data ?? false;
}

export async function adminUpsertSubject(id: string | null, name: string, code: string) {
  const { data, error } = await supabase.rpc("admin_upsert_subject", { _id: id as string, _name: name, _code: code });
  if (error) throw error;
  return data;
}

export async function adminUpsertTerm(id: string | null, name: string, startsAt: string | null, endsAt: string | null, isCurrent: boolean) {
  const { data, error } = await supabase.rpc("admin_upsert_term", {
    _id: id as string,
    _name: name,
    _starts_at: startsAt as string,
    _ends_at: endsAt as string,
    _is_current: isCurrent,
  });
  if (error) throw error;
  return data;
}

