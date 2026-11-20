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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approved_facts: {
        Row: {
          context_terms: string[]
          created_at: string
          fact_key: string
          fact_type: string
          id: string
          label: string
          numeric_value: number | null
          statement: string
        }
        Insert: {
          context_terms?: string[]
          created_at?: string
          fact_key: string
          fact_type?: string
          id?: string
          label: string
          numeric_value?: number | null
          statement: string
        }
        Update: {
          context_terms?: string[]
          created_at?: string
          fact_key?: string
          fact_type?: string
          id?: string
          label?: string
          numeric_value?: number | null
          statement?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_role: string
          created_at: string
          details: Json
          id: string
          submission_id: string | null
        }
        Insert: {
          action: string
          actor_role?: string
          created_at?: string
          details?: Json
          id?: string
          submission_id?: string | null
        }
        Update: {
          action?: string
          actor_role?: string
          created_at?: string
          details?: Json
          id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          label: string
          severity: string
          sort: number
          suggestion: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          kind: string
          label: string
          severity?: string
          sort?: number
          suggestion?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          label?: string
          severity?: string
          sort?: number
          suggestion?: string
          value?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_role: string
          body: string
          created_at: string
          id: string
          submission_id: string
        }
        Insert: {
          author_role?: string
          body: string
          created_at?: string
          id?: string
          submission_id: string
        }
        Update: {
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          category: string
          citation: string
          created_at: string
          dismiss_reason: string | null
          explanation: string
          id: string
          matched_text: string
          revision: number
          rule_ref: string
          severity: string
          status: string
          submission_id: string
          suggestion: string | null
        }
        Insert: {
          category: string
          citation?: string
          created_at?: string
          dismiss_reason?: string | null
          explanation?: string
          id?: string
          matched_text?: string
          revision?: number
          rule_ref?: string
          severity?: string
          status?: string
          submission_id: string
          suggestion?: string | null
        }
        Update: {
          category?: string
          citation?: string
          created_at?: string
          dismiss_reason?: string | null
          explanation?: string
          id?: string
          matched_text?: string
          revision?: number
          rule_ref?: string
          severity?: string
          status?: string
          submission_id?: string
          suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "findings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          author_name: string
          bg_color: string | null
          body: string
          content_type: string
          created_at: string
          id: string
          image_alt: string
          image_url: string | null
          is_sample: boolean
          revision: number
          status: string
          text_color: string | null
          title: string
          updated_at: string
          workspace_hash: string | null
        }
        Insert: {
          author_name?: string
          bg_color?: string | null
          body?: string
          content_type?: string
          created_at?: string
          id?: string
          image_alt?: string
          image_url?: string | null
          is_sample?: boolean
          revision?: number
          status?: string
          text_color?: string | null
          title?: string
          updated_at?: string
          workspace_hash?: string | null
        }
        Update: {
          author_name?: string
          bg_color?: string | null
          body?: string
          content_type?: string
          created_at?: string
          id?: string
          image_alt?: string
          image_url?: string | null
          is_sample?: boolean
          revision?: number
          status?: string
          text_color?: string | null
          title?: string
          updated_at?: string
          workspace_hash?: string | null
        }
        Relationships: []
      }
      terminology: {
        Row: {
          created_at: string
          id: string
          incorrect: string[]
          note: string
          preferred: string
          requires_phrase: string
          rule_type: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          incorrect?: string[]
          note?: string
          preferred: string
          requires_phrase?: string
          rule_type?: string
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          incorrect?: string[]
          note?: string
          preferred?: string
          requires_phrase?: string
          rule_type?: string
          severity?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
