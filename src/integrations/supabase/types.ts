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
      grades: {
        Row: {
          absences: number
          created_at: string
          id: string
          period: number
          score: number
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          absences?: number
          created_at?: string
          id?: string
          period: number
          score: number
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          absences?: number
          created_at?: string
          id?: string
          period?: number
          score?: number
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          created_at: string
          updated_at: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
        }
        Insert: {
          id?: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          created_at?: string
          updated_at?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
        }
        Update: {
          id?: string
          teacher_id?: string
          classroom?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          created_at: string
          updated_at: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
        }
        Insert: {
          id?: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description?: string
          due_at?: string | null
          created_at?: string
          updated_at?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
        }
        Update: {
          id?: string
          teacher_id?: string
          classroom?: string
          subject?: string
          title?: string
          description?: string
          due_at?: string | null
          created_at?: string
          updated_at?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          task_id: string
          student_id: string
          completed: boolean
          updated_at: string
        }
        Insert: {
          task_id: string
          student_id: string
          completed?: boolean
          updated_at?: string
        }
        Update: {
          task_id?: string
          student_id?: string
          completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          created_at: string
          enrollment: string
          full_name: string
          id: string
          teacher_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attendance?: number | null
          avatar_url?: string | null
          claim_code?: string
          classroom: string
          created_at?: string
          enrollment: string
          full_name: string
          id?: string
          teacher_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attendance?: number | null
          avatar_url?: string | null
          claim_code?: string
          classroom?: string
          created_at?: string
          enrollment?: string
          full_name?: string
          id?: string
          teacher_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      student_list_announcements: {
        Args: never
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }[]
      }
      student_list_tasks: {
        Args: never
        Returns: {
          id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          completed: boolean
        }[]
      }
      student_set_task_completed: {
        Args: { _completed: boolean; _task_id: string }
        Returns: boolean
      }
      teacher_list_roster: {
        Args: never
        Returns: {
          attendance: number | null
          classroom: string
          classroom_id: string | null
          enrollment: string
          full_name: string
          id: string
          teacher_id: string | null
        }[]
      }
      teacher_link_roster_student: {
        Args: { _classroom: string; _enrollment: string; _student_id: string }
        Returns: {
          attendance: number | null
          classroom: string
          classroom_id: string | null
          enrollment: string
          full_name: string
          id: string
          teacher_id: string | null
        }[]
      }
      teacher_unlink_roster_student: {
        Args: { _student_id: string }
        Returns: boolean
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
      student_mark_notification_read: {
        Args: { _id: string }
        Returns: boolean
      }
      admin_set_account_status: {
        Args: { _status: string; _user_id: string }
        Returns: boolean
      }
      teacher_list_announcements: {
        Args: never
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_list_tasks: {
        Args: never
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_update_announcement: {
        Args: {
          _attachment_name?: string | null
          _attachment_path?: string | null
          _attachment_size?: number | null
          _attachment_type?: string | null
          _classroom: string
          _content: string
          _id: string
          _title: string
        }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
      }
      teacher_delete_announcement: {
        Args: { _id: string }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
      }
      teacher_update_task: {
        Args: {
          _attachment_name?: string | null
          _attachment_path?: string | null
          _attachment_size?: number | null
          _attachment_type?: string | null
          _classroom: string
          _description: string
          _due_at: string | null
          _id: string
          _subject: string
          _title: string
        }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
      }
      teacher_delete_task: {
        Args: { _id: string }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
      }
      teacher_create_announcement: {
        Args: {
          _attachment_name?: string | null
          _attachment_path?: string | null
          _attachment_size?: number | null
          _attachment_type?: string | null
          _classroom: string
          _content: string
          _title: string
        }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_unlink_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      teacher_create_task: {
        Args: {
          _attachment_name?: string | null
          _attachment_path?: string | null
          _attachment_size?: number | null
          _attachment_type?: string | null
          _classroom: string
          _description: string
          _due_at: string | null
          _subject: string
          _title: string
        }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          subject: string
          title: string
          description: string
          due_at: string | null
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }

      account_list_institutions: {
        Args: never
        Returns: { id: string; name: string; slug: string; status: string; role: string; is_active: boolean }[]
      }
      account_set_institution: {
        Args: { _institution_id: string }
        Returns: boolean
      }
      admin_create_institution: {
        Args: { _name: string; _slug: string; _school_directory_id?: string | null }
        Returns: string
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
      admin_list_accounts: {
        Args: never
        Returns: {
          academic_role: string
          display_name: string
          email: string
          is_administrator: boolean
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
      admin_set_academic_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      admin_set_teacher_access: {
        Args: { _email: string; _enabled: boolean }
        Returns: boolean
      }
      claim_student: {
        Args: { _code: string; _enrollment: string }
        Returns: boolean
      }
      ensure_student_profile: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      student_get_profile: {
        Args: never
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          created_at: string
          enrollment: string
          full_name: string
          id: string
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
      student_update_profile: {
        Args: { _avatar_url?: string; _full_name: string }
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          created_at: string
          enrollment: string
          full_name: string
          id: string
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
      teacher_link_student: {
        Args: { _classroom: string; _enrollment: string; _student_id: string }
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          created_at: string
          enrollment: string
          full_name: string
          id: string
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
      teacher_list_students: {
        Args: never
        Returns: {
          attendance: number | null
          avatar_url: string | null
          claim_code: string
          classroom: string
          created_at: string
          enrollment: string
          full_name: string
          id: string
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
      teacher_update_attendance: {
        Args: { _attendance: number; _student_id: string }
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
          period: number
          score: number
          student_id: string
          subject: string
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
    teacher_list_classrooms: {
      Args: never
      Returns: {
        id: string
        name: string
        code: string | null
        status: string
        student_count: number
      }[]
    }
    teacher_get_attendance: {
      Args: { _classroom_id: string; _date: string }
      Returns: {
        student_id: string
        full_name: string
        enrollment: string
        status: string
        note: string
      }[]
    }
    teacher_save_attendance: {
      Args: { _classroom_id: string; _date: string; _rows: Json }
      Returns: number
    }
    student_list_attendance: {
      Args: { _limit?: number }
      Returns: {
        attendance_date: string
        status: string
        note: string | null
        classroom: string
      }[]
    }
    teacher_list_academic_options: {
      Args: never
      Returns: Json
    }
    teacher_list_assessments: {
      Args: { _classroom_id: string }
      Returns: {
        id: string
        title: string
        assessment_type: string
        weight: number
        max_score: number
        due_at: string | null
        status: string
        subject_id: string | null
        subject_name: string
        term_id: string | null
        term_name: string
      }[]
    }
    teacher_create_assessment: {
      Args: {
        _classroom_id: string
        _subject_id: string | null
        _term_id: string | null
        _title: string
        _type: string
        _weight: number
        _max_score: number
        _due_at: string | null
      }
      Returns: string
    }
    teacher_upsert_assessment_score: {
      Args: { _assessment_id: string; _student_id: string; _score: number | null; _feedback: string | null }
      Returns: boolean
    }
    student_list_assessments: {
      Args: never
      Returns: {
        id: string
        title: string
        assessment_type: string
        weight: number
        max_score: number
        due_at: string | null
        status: string
        subject_name: string
        term_name: string
        score: number | null
        feedback: string | null
      }[]
    }
    student_submit_task: {
      Args: { _task_id: string; _content: string }
      Returns: string
    }
    student_list_task_submissions: {
      Args: never
      Returns: {
        id: string
        task_id: string
        content: string
        attachment_path: string | null
        attachment_name: string | null
        status: string
        submitted_at: string
        score: number | null
        feedback: string | null
      }[]
    }
    teacher_list_task_submissions: {
      Args: { _task_id: string }
      Returns: {
        id: string
        task_id: string
        student_id: string
        student_name: string
        enrollment: string
        content: string
        status: string
        submitted_at: string
        score: number | null
        feedback: string | null
      }[]
    }
    teacher_grade_submission: {
      Args: { _submission_id: string; _score: number | null; _feedback: string | null }
      Returns: boolean
    }
    teacher_list_calendar: {
      Args: { _from: string; _to: string }
      Returns: {
        id: string
        classroom_id: string | null
        classroom_name: string | null
        title: string
        description: string
        start_at: string
        end_at: string | null
        event_type: string
        status: string
      }[]
    }
    student_list_calendar: {
      Args: { _from: string; _to: string }
      Returns: {
        id: string
        classroom_id: string | null
        classroom_name: string | null
        title: string
        description: string
        start_at: string
        end_at: string | null
        event_type: string
        status: string
      }[]
    }
    teacher_create_calendar_event: {
      Args: {
        _classroom_id: string | null
        _title: string
        _description: string
        _start_at: string
        _end_at: string | null
        _event_type: string
      }
      Returns: string
    }
    admin_list_academic_setup: {
      Args: never
      Returns: Json
    }
    admin_upsert_classroom: {
      Args: { _id: string | null; _name: string; _code: string }
      Returns: string
    }
    admin_archive_classroom: {
      Args: { _id: string }
      Returns: boolean
    }
    admin_upsert_subject: {
      Args: { _id: string | null; _name: string; _code: string }
      Returns: string
    }
    admin_upsert_term: {
      Args: { _id: string | null; _name: string; _starts_at: string | null; _ends_at: string | null; _is_current: boolean }
      Returns: string
    }
    teacher_get_class_report: {
      Args: { _classroom_id: string }
      Returns: {
        student_id: string
        student_name: string
        enrollment: string
        attendance_percent: number | null
        grade_average: number
        assessment_count: number
      }[]
    }
    ensure_account_onboarding: {
      Args: { _requested_role?: string | null }
      Returns: Json
    }
    account_get_onboarding_state: {
      Args: Record<PropertyKey, never>
      Returns: Json
    }
    account_resubmit_role_request: {
      Args: { _requested_role: string }
      Returns: boolean
    }
    admin_list_role_requests: {
      Args: Record<PropertyKey, never>
      Returns: Json
    }
    admin_review_role_request: {
      Args: { _request_id: string; _decision: string; _approved_role: string; _note: string }
      Returns: boolean
    }
    school_directory_search: {
      Args: { _municipality?: string; _network_type?: string | null; _search?: string }
      Returns: {
        id: string
        name: string
        municipality: string
        state: string
        network_type: string
        inep_code: string | null
        institution_id: string | null
      }[]
    }
    ensure_account_onboarding_v2: {
      Args: { _requested_role: string; _school_directory_id: string }
      Returns: Json
    }
    admin_review_role_request_v2: {
      Args: { _request_id: string; _decision: string; _approved_role: string; _note: string }
      Returns: boolean
    }
    admin_list_role_requests_v2: {
      Args: Record<PropertyKey, never>
      Returns: {
        id: string
        user_id: string
        email: string
        display_name: string
        requested_role: string
        status: string
        review_note: string | null
        created_at: string
        reviewed_at: string | null
        school_directory_id: string | null
        school_name: string | null
        school_network_type: string | null
      }[]
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
