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
        }
        Insert: {
          id?: string
          teacher_id: string
          classroom: string
          title: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          classroom?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
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
          created_at: string
          completed: boolean
        }[]
      }
      student_set_task_completed: {
        Args: { _completed: boolean; _task_id: string }
        Returns: boolean
      }
      teacher_create_announcement: {
        Args: { _classroom: string; _content: string; _title: string }
        Returns: {
          id: string
          teacher_id: string
          classroom: string
          title: string
          content: string
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
      teacher_create_task: {
        Args: {
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
