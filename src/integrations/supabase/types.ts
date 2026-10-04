export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_terms: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          institution_id: string
          is_current: boolean
          name: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          institution_id: string
          is_current?: boolean
          name: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          institution_id?: string
          is_current?: boolean
          name?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      account_role_requests: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_directory_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_directory_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_directory_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_role_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_role_requests_school_directory_id_fkey"
            columns: ["school_directory_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          content: string
          created_at: string
          id: string
          institution_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          classroom: string
          classroom_id?: string | null
          content: string
          created_at?: string
          id?: string
          institution_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          classroom?: string
          classroom_id?: string | null
          content?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          score: number | null
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string
          classroom_id: string
          created_at: string
          due_at: string | null
          id: string
          institution_id: string
          max_score: number
          status: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          assessment_type?: string
          classroom_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          institution_id: string
          max_score?: number
          status?: string
          subject_id?: string | null
          teacher_id: string
          term_id?: string | null
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          assessment_type?: string
          classroom_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          institution_id?: string
          max_score?: number
          status?: string
          subject_id?: string | null
          teacher_id?: string
          term_id?: string | null
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          classroom_id: string
          created_at: string
          id: string
          institution_id: string
          note: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          classroom_id: string
          created_at?: string
          id?: string
          institution_id: string
          note?: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          classroom_id?: string
          created_at?: string
          id?: string
          institution_id?: string
          note?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          classroom_id: string | null
          created_at: string
          created_by: string
          description: string
          end_at: string | null
          event_type: string
          id: string
          institution_id: string
          start_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          created_by: string
          description?: string
          end_at?: string | null
          event_type?: string
          id?: string
          institution_id: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          end_at?: string | null
          event_type?: string
          id?: string
          institution_id?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_subjects: {
        Row: {
          classroom_id: string
          created_at: string
          id: string
          institution_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          id?: string
          institution_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          id?: string
          institution_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_subjects_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_teachers: {
        Row: {
          classroom_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_teachers_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          code: string | null
          created_at: string
          id: string
          institution_id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          institution_id: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          absences: number
          created_at: string
          id: string
          institution_id: string | null
          period: number
          score: number
          student_id: string
          subject: string
          subject_id: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          absences?: number
          created_at?: string
          id?: string
          institution_id?: string | null
          period: number
          score: number
          student_id: string
          subject: string
          subject_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          absences?: number
          created_at?: string
          id?: string
          institution_id?: string | null
          period?: number
          score?: number
          student_id?: string
          subject?: string
          subject_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_memberships: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          school_directory_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_directory_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_directory_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutions_school_directory_id_fkey"
            columns: ["school_directory_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_directory: {
        Row: {
          administrative_type: string
          created_at: string
          id: string
          inep_code: string | null
          institution_id: string | null
          municipality: string
          name: string
          network_type: string
          normalized_name: string
          source: string
          source_year: number | null
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          administrative_type?: string
          created_at?: string
          id?: string
          inep_code?: string | null
          institution_id?: string | null
          municipality?: string
          name: string
          network_type: string
          normalized_name: string
          source?: string
          source_year?: number | null
          state?: string
          status?: string
          updated_at?: string
        }
        Update: {
          administrative_type?: string
          created_at?: string
          id?: string
          inep_code?: string | null
          institution_id?: string | null
          municipality?: string
          name?: string
          network_type?: string
          normalized_name?: string
          source?: string
          source_year?: number | null
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_directory_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          classroom_id: string | null
          created_at: string
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attendance?: number | null
          avatar_url?: string | null
          claim_code?: string
          classroom: string
          classroom_id?: string | null
          created_at?: string
          enrollment: string
          full_name: string
          id?: string
          institution_id?: string | null
          teacher_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attendance?: number | null
          avatar_url?: string | null
          claim_code?: string
          classroom?: string
          classroom_id?: string | null
          created_at?: string
          enrollment?: string
          full_name?: string
          id?: string
          institution_id?: string | null
          teacher_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed: boolean
          student_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          student_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          student_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_submissions: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          content: string
          feedback: string | null
          graded_at: string | null
          id: string
          score: number | null
          status: string
          student_id: string
          submitted_at: string
          task_id: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          feedback?: string | null
          graded_at?: string | null
          id?: string
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          feedback?: string | null
          graded_at?: string | null
          id?: string
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          institution_id: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          classroom: string
          classroom_id?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          id?: string
          institution_id?: string | null
          subject: string
          subject_id?: string | null
          teacher_id: string
          term_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          classroom?: string
          classroom_id?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          id?: string
          institution_id?: string | null
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          term_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_institution_context: {
        Row: {
          institution_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          institution_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          institution_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_institution_context_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_get_onboarding_state: { Args: never; Returns: Json }
      account_list_institutions: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          name: string
          role: string
          slug: string
          status: string
        }[]
      }
      account_resubmit_role_request: {
        Args: { _requested_role: string }
        Returns: boolean
      }
      account_set_institution: {
        Args: { _institution_id: string }
        Returns: boolean
      }
      admin_archive_classroom: { Args: { _id: string }; Returns: boolean }
      admin_assign_student_to_classroom: {
        Args: {
          _classroom_id: string
          _enrollment?: string
          _student_id: string
        }
        Returns: boolean
      }
      admin_assign_teacher_to_classroom: {
        Args: { _classroom_id: string; _teacher_id: string }
        Returns: boolean
      }
      admin_create_institution: {
        Args: { _name: string; _school_directory_id?: string; _slug: string }
        Returns: string
      }
      admin_list_academic_setup: { Args: never; Returns: Json }
      admin_list_accounts: {
        Args: never
        Returns: {
          academic_role: string
          account_status: string
          display_name: string
          email: string
          is_administrator: boolean
          user_id: string
        }[]
      }
      admin_list_audit_logs: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_linkable_institutions: {
        Args: never
        Returns: {
          id: string
          name: string
          school_directory_id: string | null
          slug: string
          status: string
        }[]
      }
      admin_list_institution_teachers: {
        Args: never
        Returns: {
          display_name: string
          email: string
          user_id: string
        }[]
      }
      admin_list_role_requests: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          requested_role: string
          review_note: string
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      admin_list_role_requests_v2: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          requested_role: string
          review_note: string
          reviewed_at: string
          school_directory_id: string
          school_name: string
          school_network_type: string
          status: string
          user_id: string
        }[]
      }
      admin_list_student_school_links: {
        Args: never
        Returns: {
          classroom_id: string | null
          classroom_name: string | null
          enrollment: string | null
          full_name: string
          id: string
          institution_id: string | null
          institution_name: string | null
          status: string
          user_id: string | null
        }[]
      }
      admin_list_students: {
        Args: never
        Returns: {
          classroom_id: string
          classroom_name: string
          enrollment: string
          full_name: string
          id: string
          status: string
          user_id: string
        }[]
      }
      admin_list_teacher_classroom_assignments: {
        Args: never
        Returns: {
          classroom_id: string
          classroom_name: string
          teacher_email: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      admin_list_teacher_school_links: {
        Args: never
        Returns: {
          display_name: string
          email: string
          institution_id: string | null
          institution_name: string | null
          school_count: number
          user_id: string
        }[]
      }
      admin_list_teachers: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          user_id: string
        }[]
      }
      admin_remove_student_from_classroom: {
        Args: { _student_id: string }
        Returns: boolean
      }
      admin_link_student_to_institution: {
        Args: { _institution_id: string; _student_id: string }
        Returns: boolean
      }
      admin_review_role_request: {
        Args: {
          _approved_role: string
          _decision: string
          _note: string
          _request_id: string
        }
        Returns: boolean
      }
      admin_set_academic_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      admin_set_account_status: {
        Args: { _status: string; _user_id: string }
        Returns: boolean
      }
      admin_set_teacher_access: {
        Args: { _email: string; _enabled: boolean }
        Returns: boolean
      }
      admin_unassign_teacher_from_classroom: {
        Args: { _classroom_id: string; _teacher_id: string }
        Returns: boolean
      }
      admin_upsert_classroom: {
        Args: { _code: string; _id: string; _name: string }
        Returns: string
      }
      admin_upsert_subject: {
        Args: { _code: string; _id: string; _name: string }
        Returns: string
      }
      admin_upsert_term: {
        Args: {
          _ends_at: string
          _id: string
          _is_current: boolean
          _name: string
          _starts_at: string
        }
        Returns: string
      }
      claim_student: {
        Args: { _code: string; _enrollment: string }
        Returns: boolean
      }
      ensure_account_onboarding: {
        Args: { _requested_role?: string }
        Returns: Json
      }
      ensure_account_onboarding_v2: {
        Args: { _requested_role: string; _school_directory_id: string }
        Returns: Json
      }
      ensure_student_profile: { Args: never; Returns: boolean }
      ensure_student_profile_for_user:
        | { Args: { _user_id: string }; Returns: boolean }
        | {
            Args: { _institution_id: string; _user_id: string }
            Returns: boolean
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      school_directory_search: {
        Args: {
          _municipality?: string
          _network_type?: string
          _search?: string
        }
        Returns: {
          id: string
          inep_code: string
          institution_id: string
          municipality: string
          name: string
          network_type: string
          state: string
        }[]
      }
      student_get_profile: {
        Args: never
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          classroom_id: string | null
          created_at: string
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      student_list_announcements: {
        Args: never
        Returns: {
          attachment_name: string
          attachment_path: string
          attachment_size: number
          attachment_type: string
          classroom: string
          content: string
          created_at: string
          id: string
          teacher_id: string
          title: string
          updated_at: string
        }[]
      }
      student_list_assessments: {
        Args: never
        Returns: {
          assessment_type: string
          due_at: string
          feedback: string
          id: string
          max_score: number
          score: number
          status: string
          subject_name: string
          term_name: string
          title: string
          weight: number
        }[]
      }
      student_list_attendance: {
        Args: { _limit?: number }
        Returns: {
          attendance_date: string
          classroom: string
          note: string
          status: string
        }[]
      }
      student_list_calendar: {
        Args: { _from: string; _to: string }
        Returns: {
          classroom_id: string
          classroom_name: string
          description: string
          end_at: string
          event_type: string
          id: string
          start_at: string
          status: string
          title: string
        }[]
      }
      student_list_grades: {
        Args: never
        Returns: {
          absences: number
          created_at: string
          id: string
          institution_id: string | null
          period: number
          score: number
          student_id: string
          subject: string
          subject_id: string | null
          term_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "grades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      student_list_notifications: {
        Args: { _limit?: number; _unread_only?: boolean }
        Returns: {
          body: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      student_list_subjects: {
        Args: never
        Returns: {
          classroom_id: string
          classroom_name: string
          code: string
          id: string
          name: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      student_list_task_submissions: {
        Args: never
        Returns: {
          attachment_name: string
          attachment_path: string
          content: string
          feedback: string
          id: string
          score: number
          status: string
          submitted_at: string
          task_id: string
        }[]
      }
      student_list_tasks: {
        Args: never
        Returns: {
          attachment_name: string
          attachment_path: string
          attachment_size: number
          attachment_type: string
          classroom: string
          completed: boolean
          created_at: string
          description: string
          due_at: string
          id: string
          subject: string
          title: string
        }[]
      }
      student_mark_notification_read: {
        Args: { _id: string }
        Returns: boolean
      }
      student_set_task_completed: {
        Args: { _completed: boolean; _task_id: string }
        Returns: boolean
      }
      student_submit_task: {
        Args: { _content: string; _task_id: string }
        Returns: string
      }
      student_update_profile: {
        Args: { _avatar_url?: string; _full_name: string }
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          classroom_id: string | null
          created_at: string
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_archive_subject: { Args: { _id: string }; Returns: boolean }
      teacher_assign_subject_to_class: {
        Args: { _classroom_id: string; _subject_id: string }
        Returns: string
      }
      teacher_bulk_upsert_grades: {
        Args: {
          _classroom_id: string
          _period: number
          _rows: Json
          _subject: string
        }
        Returns: number
      }
      teacher_create_announcement: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _attachment_size?: number
          _attachment_type?: string
          _classroom: string
          _content: string
          _title: string
        }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          content: string
          created_at: string
          id: string
          institution_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_create_assessment: {
        Args: {
          _classroom_id: string
          _due_at: string
          _max_score: number
          _subject_id: string
          _term_id: string
          _title: string
          _type: string
          _weight: number
        }
        Returns: string
      }
      teacher_create_calendar_event: {
        Args: {
          _classroom_id: string
          _description: string
          _end_at: string
          _event_type: string
          _start_at: string
          _title: string
        }
        Returns: string
      }
      teacher_create_classroom: {
        Args: { _code: string; _name: string }
        Returns: string
      }
      teacher_create_subject: {
        Args: { _code: string; _name: string }
        Returns: string
      }
      teacher_create_task: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _attachment_size?: number
          _attachment_type?: string
          _classroom: string
          _description: string
          _due_at: string
          _subject: string
          _title: string
        }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          institution_id: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_delete_announcement: {
        Args: { _id: string }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          content: string
          created_at: string
          id: string
          institution_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_delete_task: {
        Args: { _id: string }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          institution_id: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_enroll_student_in_classroom: {
        Args: { _classroom_id: string; _enrollment: string; _student_id: string }
        Returns: boolean
      }
      teacher_get_attendance: {
        Args: { _classroom_id: string; _date: string }
        Returns: {
          enrollment: string
          full_name: string
          note: string
          status: string
          student_id: string
        }[]
      }
      teacher_get_class_report: {
        Args: { _classroom_id: string }
        Returns: {
          assessment_count: number
          attendance_percent: number
          enrollment: string
          grade_average: number
          student_id: string
          student_name: string
        }[]
      }
      teacher_grade_submission: {
        Args: { _feedback: string; _score: number; _submission_id: string }
        Returns: boolean
      }
      teacher_link_roster_student: {
        Args: { _classroom: string; _enrollment: string; _student_id: string }
        Returns: {
          attendance: number
          classroom: string
          classroom_id: string
          enrollment: string
          full_name: string
          id: string
          teacher_id: string
        }[]
      }
      teacher_link_student: {
        Args: { _classroom: string; _enrollment: string; _student_id: string }
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          classroom_id: string | null
          created_at: string
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_link_student_to_school: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_list_academic_options: { Args: never; Returns: Json }
      teacher_list_announcements: {
        Args: never
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          content: string
          created_at: string
          id: string
          institution_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_list_assessments: {
        Args: { _classroom_id: string }
        Returns: {
          assessment_type: string
          due_at: string
          id: string
          max_score: number
          status: string
          subject_id: string
          subject_name: string
          term_id: string
          term_name: string
          title: string
          weight: number
        }[]
      }
      teacher_list_calendar: {
        Args: { _from: string; _to: string }
        Returns: {
          classroom_id: string
          classroom_name: string
          description: string
          end_at: string
          event_type: string
          id: string
          start_at: string
          status: string
          title: string
        }[]
      }
      teacher_list_classrooms: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
          status: string
          student_count: number
        }[]
      }
      teacher_list_grades: {
        Args: { _student_id: string }
        Returns: {
          absences: number
          created_at: string
          id: string
          institution_id: string | null
          period: number
          score: number
          student_id: string
          subject: string
          subject_id: string | null
          term_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "grades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_list_institution_students: {
        Args: never
        Returns: {
          attendance: number | null
          class_status: string
          classroom: string
          classroom_id: string | null
          enrollment: string
          full_name: string
          id: string
          teacher_id: string | null
        }[]
      }
      teacher_list_roster: {
        Args: never
        Returns: {
          attendance: number
          classroom: string
          classroom_id: string
          enrollment: string
          full_name: string
          id: string
          teacher_id: string
        }[]
      }
      teacher_list_students: {
        Args: never
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          classroom_id: string | null
          created_at: string
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_list_unassigned_students: {
        Args: never
        Returns: {
          classroom_id: string | null
          classroom_name: string | null
          enrollment: string
          full_name: string
          id: string
          institution_id: string | null
          institution_name: string | null
          status: string
          user_id: string | null
        }[]
      }
      teacher_list_subject_assignments: {
        Args: never
        Returns: {
          classroom_id: string
          classroom_name: string
          id: string
          subject_id: string
          subject_name: string
          teacher_id: string
        }[]
      }
      teacher_list_subjects: {
        Args: never
        Returns: {
          code: string
          created_by: string
          id: string
          name: string
          status: string
        }[]
      }
      teacher_list_task_submissions: {
        Args: { _task_id: string }
        Returns: {
          content: string
          enrollment: string
          feedback: string
          id: string
          score: number
          status: string
          student_id: string
          student_name: string
          submitted_at: string
          task_id: string
        }[]
      }
      teacher_list_tasks: {
        Args: never
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          institution_id: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_remove_student_from_classroom: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_save_attendance: {
        Args: { _classroom_id: string; _date: string; _rows: Json }
        Returns: number
      }
      teacher_unassign_subject_from_class: {
        Args: { _id: string }
        Returns: boolean
      }
      teacher_unlink_roster_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_unlink_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_update_announcement: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _attachment_size?: number
          _attachment_type?: string
          _classroom: string
          _content: string
          _id: string
          _title: string
        }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          content: string
          created_at: string
          id: string
          institution_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_update_attendance: {
        Args: { _attendance: number; _student_id: string }
        Returns: boolean
      }
      teacher_update_subject: {
        Args: { _code: string; _id: string; _name: string }
        Returns: boolean
      }
      teacher_update_task: {
        Args: {
          _attachment_name?: string
          _attachment_path?: string
          _attachment_size?: number
          _attachment_type?: string
          _classroom: string
          _description: string
          _due_at: string
          _id: string
          _subject: string
          _title: string
        }
        Returns: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          classroom: string
          classroom_id: string | null
          created_at: string
          description: string
          due_at: string | null
          id: string
          institution_id: string | null
          subject: string
          subject_id: string | null
          teacher_id: string
          term_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_upsert_assessment_score: {
        Args: {
          _assessment_id: string
          _feedback: string
          _score: number
          _student_id: string
        }
        Returns: boolean
      }
      teacher_upsert_grade: {
        Args: {
          _absences: number
          _period: number
          _score: number
          _student_id: string
          _subject: string
        }
        Returns: {
          absences: number
          created_at: string
          id: string
          institution_id: string | null
          period: number
          score: number
          student_id: string
          subject: string
          subject_id: string | null
          term_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "grades"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "admin"],
    },
  },
} as const
