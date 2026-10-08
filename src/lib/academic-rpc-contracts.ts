import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

// Contracts for the institution-scoped academic RPCs introduced by the
// period-lock, grade-audit and responsibility migrations. The explicit client
// type keeps these RPC calls type-safe until Supabase generated types are
// refreshed from the connected schema.
type FunctionContract<Args, Returns> = { Args: Args; Returns: Returns };
type SubjectLinkArgs = { _classroom_id: string; _subject_id: string; _teacher_id: string };
type PeriodLock = { period: number; is_closed: boolean; closed_at: string | null; closed_by: string | null };
type Responsibility = {
  classroom_id: string; classroom_name: string; subject_id: string; subject_name: string;
  teacher_id: string; teacher_name: string; is_primary: boolean;
};
type MigrationFunctions = {
  teacher_list_subject_responsibilities: FunctionContract<Record<string, never>, Responsibility[]>;
  teacher_clear_gradebook_scores: FunctionContract<{
    _classroom_id: string; _subject_id: string; _period: number; _rows: Json;
  }, number>;
  admin_list_subject_teacher_matrix: FunctionContract<Record<string, never>, Array<Responsibility & {
    id: string; teacher_id: string | null; teacher_email: string | null; teacher_count: number;
  }>>;
  admin_set_subject_responsible: FunctionContract<Omit<SubjectLinkArgs, "_teacher_id"> & { _teacher_id: string | null }, boolean>;
  admin_set_subject_teacher_link: FunctionContract<SubjectLinkArgs & { _is_primary?: boolean }, boolean>;
  admin_remove_subject_teacher_link: FunctionContract<SubjectLinkArgs, boolean>;
  admin_list_grade_change_audit: FunctionContract<{ _limit?: number }, Array<{
    id: string; grade_id: string | null; student_id: string; student_name: string | null;
    subject_id: string | null; subject: string | null; period: number;
    action: "insert" | "update" | "delete"; changed_by: string | null; changed_at: string;
    old_score: number | null; new_score: number | null; old_absences: number | null; new_absences: number | null;
  }>>;
  teacher_get_gradebook_period_status: FunctionContract<{ _period: number }, Omit<PeriodLock, "closed_by">[]>;
  admin_list_academic_period_locks: FunctionContract<Record<string, never>, PeriodLock[]>;
  admin_set_academic_period_lock: FunctionContract<{ _period: number; _closed: boolean }, boolean>;
};
type AcademicDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & MigrationFunctions;
  };
};
export const academicRpcClient = supabase as unknown as SupabaseClient<AcademicDatabase>;