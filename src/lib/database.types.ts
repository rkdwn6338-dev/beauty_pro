export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      // Phase C 검토안의 타입입니다. 실제 DB 적용 전 ENABLE_PLAN_STORAGE는 false를 유지합니다.
      planning_versions: {
        Row: {
          id: string;
          project_id: string;
          product_id: string;
          revision: number;
          parent_id: string | null;
          restored_from: string | null;
          action: string;
          changed_section_id: string | null;
          snapshot: Json;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_id: string;
          revision: number;
          parent_id: string | null;
          restored_from?: string | null;
          action: string;
          changed_section_id?: string | null;
          snapshot: Json;
          created_by: string;
          created_at?: string;
        };
        Update: { [_ in never]: never };
        Relationships: [
          {
            foreignKeyName: "planning_versions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      agencies: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      agency_members: {
        Row: {
          agency_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      analysis_jobs: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          result: Json | null;
          source_file_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          result?: Json | null;
          source_file_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          result?: Json | null;
          source_file_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_source_file_id_fkey";
            columns: ["source_file_id"];
            isOneToOne: false;
            referencedRelation: "source_files";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          created_at: string;
          evidence_type: string;
          extracted_result: Json;
          id: string;
          page_number: number | null;
          review_status: string;
          reviewed_by: string | null;
          source_excerpt: string;
          source_file_id: string;
          suggested_claim: string | null;
        };
        Insert: {
          created_at?: string;
          evidence_type: string;
          extracted_result?: Json;
          id?: string;
          page_number?: number | null;
          review_status?: string;
          reviewed_by?: string | null;
          source_excerpt: string;
          source_file_id: string;
          suggested_claim?: string | null;
        };
        Update: {
          created_at?: string;
          evidence_type?: string;
          extracted_result?: Json;
          id?: string;
          page_number?: number | null;
          review_status?: string;
          reviewed_by?: string | null;
          source_excerpt?: string;
          source_file_id?: string;
          suggested_claim?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_source_file_id_fkey";
            columns: ["source_file_id"];
            isOneToOne: false;
            referencedRelation: "source_files";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string | null;
          created_at: string;
          features: Json;
          highlighted_ingredients: string | null;
          id: string;
          ingredients: string | null;
          name: string;
          project_id: string;
          subtype: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          features?: Json;
          highlighted_ingredients?: string | null;
          id?: string;
          ingredients?: string | null;
          name: string;
          project_id: string;
          subtype?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          features?: Json;
          highlighted_ingredients?: string | null;
          id?: string;
          ingredients?: string | null;
          name?: string;
          project_id?: string;
          subtype?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          agency_id: string;
          brand: string;
          created_at: string;
          created_by: string | null;
          id: string;
          title: string;
        };
        Insert: {
          agency_id: string;
          brand: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title: string;
        };
        Update: {
          agency_id?: string;
          brand?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      section_evidence: {
        Row: {
          evidence_id: string;
          section_id: string;
        };
        Insert: {
          evidence_id: string;
          section_id: string;
        };
        Update: {
          evidence_id?: string;
          section_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "section_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "section_evidence_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
        ];
      };
      sections: {
        Row: {
          body: string | null;
          created_at: string;
          headline: string | null;
          id: string;
          position: number;
          product_id: string;
          section_type: string;
          status: string;
          version: number;
          visual_guide: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          position: number;
          product_id: string;
          section_type: string;
          status?: string;
          version?: number;
          visual_guide?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          position?: number;
          product_id?: string;
          section_type?: string;
          status?: string;
          version?: number;
          visual_guide?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sections_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      source_files: {
        Row: {
          bytes: number | null;
          created_at: string;
          filename: string;
          id: string;
          mime_type: string | null;
          product_id: string | null;
          project_id: string;
          status: string;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          bytes?: number | null;
          created_at?: string;
          filename: string;
          id?: string;
          mime_type?: string | null;
          product_id?: string | null;
          project_id: string;
          status?: string;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          bytes?: number | null;
          created_at?: string;
          filename?: string;
          id?: string;
          mime_type?: string | null;
          product_id?: string | null;
          project_id?: string;
          status?: string;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "source_files_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_project: { Args: { p: string }; Returns: boolean };
      is_agency_member: { Args: { a: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
