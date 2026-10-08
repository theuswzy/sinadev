import { supabase } from "@/integrations/supabase/client";

export type ClassroomTimetableEntry = {
  id: string;
  classroom_id: string;
  classroom_subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  notes: string | null;
  subject_id: string;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
};

export async function loadAdminClassroomTimetable(classroomId: string): Promise<ClassroomTimetableEntry[]> {
  const { data, error } = await supabase.rpc("admin_list_classroom_timetable", { _classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as ClassroomTimetableEntry[];
}

export async function adminUpsertClassroomTimetable(args: {
  id: string | null;
  classroomId: string;
  classroomSubjectId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string;
  notes: string;
}) {
  const { data, error } = await supabase.rpc("admin_upsert_classroom_timetable", {
    _id: args.id as string,
    _classroom_id: args.classroomId,
    _classroom_subject_id: args.classroomSubjectId,
    _weekday: args.weekday,
    _start_time: args.startTime,
    _end_time: args.endTime,
    _room: args.room,
    _notes: args.notes,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteClassroomTimetable(id: string) {
  const { data, error } = await supabase.rpc("admin_delete_classroom_timetable", { _id: id });
  if (error) throw error;
  if (!data) throw new Error("Horário não encontrado nesta instituição.");
  return data;
}

export async function loadStudentTimetable(): Promise<ClassroomTimetableEntry[]> {
  const { data, error } = await supabase.rpc("student_list_timetable");
  if (error) throw error;
  return (data ?? []) as ClassroomTimetableEntry[];
}

