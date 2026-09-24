export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json
          msp_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          msp_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          msp_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "activity_events_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_allowlist: {
        Row: {
          active: boolean
          created_at: string
          email: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          action_items: Json
          category: Database["public"]["Enums"]["asset_category"]
          cohort_id: string | null
          cohort_task_id: string | null
          cohort_week_id: string | null
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          mime_type: string | null
          msp_id: string | null
          program_id: string | null
          program_task_id: string | null
          program_week_id: string | null
          scope: Database["public"]["Enums"]["asset_scope"]
          session_id: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["asset_status"]
          storage_path: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_items?: Json
          category: Database["public"]["Enums"]["asset_category"]
          cohort_id?: string | null
          cohort_task_id?: string | null
          cohort_week_id?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          mime_type?: string | null
          msp_id?: string | null
          program_id?: string | null
          program_task_id?: string | null
          program_week_id?: string | null
          scope: Database["public"]["Enums"]["asset_scope"]
          session_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage_path?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_items?: Json
          category?: Database["public"]["Enums"]["asset_category"]
          cohort_id?: string | null
          cohort_task_id?: string | null
          cohort_week_id?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          mime_type?: string | null
          msp_id?: string | null
          program_id?: string | null
          program_task_id?: string | null
          program_week_id?: string | null
          scope?: Database["public"]["Enums"]["asset_scope"]
          session_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage_path?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "assets_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_cohort_task_id_fkey"
            columns: ["cohort_task_id"]
            isOneToOne: false
            referencedRelation: "cohort_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_cohort_week_id_fkey"
            columns: ["cohort_week_id"]
            isOneToOne: false
            referencedRelation: "cohort_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "assets_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_program_task_id_fkey"
            columns: ["program_task_id"]
            isOneToOne: false
            referencedRelation: "program_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_program_week_id_fkey"
            columns: ["program_week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_tasks: {
        Row: {
          archived_at: string | null
          cohort_id: string
          cohort_week_id: string
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          msp_id: string | null
          owner_label: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          position: number
          template_task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          cohort_id: string
          cohort_week_id: string
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          msp_id?: string | null
          owner_label: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          position: number
          template_task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          cohort_id?: string
          cohort_week_id?: string
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          msp_id?: string | null
          owner_label?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          position?: number
          template_task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_tasks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "cohort_tasks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_tasks_cohort_week_id_cohort_id_fkey"
            columns: ["cohort_week_id", "cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_weeks"
            referencedColumns: ["id", "cohort_id"]
          },
          {
            foreignKeyName: "cohort_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "cohort_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_tasks_template_task_id_fkey"
            columns: ["template_task_id"]
            isOneToOne: false
            referencedRelation: "program_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_weeks: {
        Row: {
          cohort_id: string
          created_at: string
          goal: string
          id: string
          subtitle: string
          template_week_id: string | null
          title: string
          updated_at: string
          week_number: number
        }
        Insert: {
          cohort_id: string
          created_at?: string
          goal?: string
          id?: string
          subtitle?: string
          template_week_id?: string | null
          title: string
          updated_at?: string
          week_number: number
        }
        Update: {
          cohort_id?: string
          created_at?: string
          goal?: string
          id?: string
          subtitle?: string
          template_week_id?: string | null
          title?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohort_weeks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "cohort_weeks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_weeks_template_week_id_fkey"
            columns: ["template_week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          name: string
          program_id: string
          session_time: string
          session_weekday: number
          start_date: string
          status_override: Database["public"]["Enums"]["cohort_status"] | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          name: string
          program_id: string
          session_time: string
          session_weekday: number
          start_date: string
          status_override?: Database["public"]["Enums"]["cohort_status"] | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          name?: string
          program_id?: string
          session_time?: string
          session_weekday?: number
          start_date?: string
          status_override?: Database["public"]["Enums"]["cohort_status"] | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          auth_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          msp_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          msp_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          msp_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "invitations_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
      msp_hidden_tasks: {
        Row: {
          cohort_task_id: string
          created_at: string
          hidden_by: string
          msp_id: string
        }
        Insert: {
          cohort_task_id: string
          created_at?: string
          hidden_by: string
          msp_id: string
        }
        Update: {
          cohort_task_id?: string
          created_at?: string
          hidden_by?: string
          msp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "msp_hidden_tasks_cohort_task_id_fkey"
            columns: ["cohort_task_id"]
            isOneToOne: false
            referencedRelation: "cohort_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msp_hidden_tasks_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msp_hidden_tasks_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msp_hidden_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "msp_hidden_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "msp_hidden_tasks_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
      msps: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          logo_path: string | null
          name: string
          status: Database["public"]["Enums"]["msp_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          status?: Database["public"]["Enums"]["msp_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          status?: Database["public"]["Enums"]["msp_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "msps_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "msps_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          last_seen_at: string | null
          msp_id: string | null
          photo_path: string | null
          role: Database["public"]["Enums"]["app_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string
          id: string
          last_seen_at?: string | null
          msp_id?: string | null
          photo_path?: string | null
          role: Database["public"]["Enums"]["app_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          last_seen_at?: string | null
          msp_id?: string | null
          photo_path?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "profiles_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          owner_label: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          position: number
          program_id: string
          title: string
          updated_at: string
          week_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          owner_label: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          position: number
          program_id: string
          title: string
          updated_at?: string
          week_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          owner_label?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          position?: number
          program_id?: string
          title?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tasks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_tasks_week_id_program_id_fkey"
            columns: ["week_id", "program_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id", "program_id"]
          },
        ]
      }
      program_weeks: {
        Row: {
          created_at: string
          goal: string
          id: string
          program_id: string
          subtitle: string
          title: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          goal?: string
          id?: string
          program_id: string
          subtitle?: string
          title: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          goal?: string
          id?: string
          program_id?: string
          subtitle?: string
          title?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          join_url: string | null
          kind: Database["public"]["Enums"]["session_kind"]
          msp_id: string | null
          starts_at: string
          title: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          join_url?: string | null
          kind: Database["public"]["Enums"]["session_kind"]
          msp_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          join_url?: string | null
          kind?: Database["public"]["Enums"]["session_kind"]
          msp_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "sessions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          cohort_task_id: string
          completed_at: string
          completed_by: string
          msp_id: string
        }
        Insert: {
          cohort_task_id: string
          completed_at?: string
          completed_by: string
          msp_id: string
        }
        Update: {
          cohort_task_id?: string
          completed_at?: string
          completed_by?: string
          msp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_cohort_task_id_fkey"
            columns: ["cohort_task_id"]
            isOneToOne: false
            referencedRelation: "cohort_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "task_completions_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notes: {
        Row: {
          author_id: string
          body: string
          cohort_task_id: string
          created_at: string
          id: string
          msp_id: string
        }
        Insert: {
          author_id: string
          body: string
          cohort_task_id: string
          created_at?: string
          id?: string
          msp_id: string
        }
        Update: {
          author_id?: string
          body?: string
          cohort_task_id?: string
          created_at?: string
          id?: string
          msp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_cohort_task_id_fkey"
            columns: ["cohort_task_id"]
            isOneToOne: false
            referencedRelation: "cohort_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "cohort_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notes_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msp_progress"
            referencedColumns: ["msp_id"]
          },
          {
            foreignKeyName: "task_notes_msp_id_fkey"
            columns: ["msp_id"]
            isOneToOne: false
            referencedRelation: "msps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cohort_leads: {
        Row: {
          cohort_id: string | null
          email: string | null
          full_name: string | null
          id: string | null
          photo_path: string | null
          title: string | null
        }
        Relationships: []
      }
      cohort_peers: {
        Row: {
          id: string | null
          logo_path: string | null
          name: string | null
          website: string | null
        }
        Relationships: []
      }
      msp_progress: {
        Row: {
          cohort_id: string | null
          current_week: number | null
          is_behind: boolean | null
          is_finished: boolean | null
          msp_id: string | null
          overall_completed_tasks: number | null
          overall_percent: number | null
          overall_total_tasks: number | null
          week_completed_tasks: number | null
          week_number: number | null
          week_percent: number | null
          week_total_tasks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "msps_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohort_leads"
            referencedColumns: ["cohort_id"]
          },
          {
            foreignKeyName: "msps_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_asset: { Args: { target_asset_id: string }; Returns: boolean }
      can_access_asset_path: { Args: { target_path: string }; Returns: boolean }
      can_access_logo_path: { Args: { target_path: string }; Returns: boolean }
      cohort_current_week: {
        Args: { target_cohort_id: string }
        Returns: number
      }
      cohort_is_writable: {
        Args: { target_cohort_id: string }
        Returns: boolean
      }
      current_cohort_id: { Args: never; Returns: string }
      current_msp_id: { Args: never; Returns: string }
      effective_cohort_status: {
        Args: { target_cohort_id: string }
        Returns: Database["public"]["Enums"]["cohort_status"]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_lemhi_admin: { Args: never; Returns: boolean }
      update_group_session_local: {
        Args: {
          local_starts_at: string
          target_join_url?: string
          target_session_id: string
          target_title: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "lemhi_admin" | "msp_owner" | "msp_member"
      asset_category:
        | "recording"
        | "transcript"
        | "documentation"
        | "marketing_asset"
        | "link"
      asset_kind: "file" | "link"
      asset_scope: "program" | "cohort" | "msp"
      asset_status: "pending" | "ready" | "failed"
      cohort_status: "upcoming" | "active" | "ended"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      msp_status: "active" | "deactivated"
      owner_type: "msp" | "lemhi"
      session_kind: "group" | "one_on_one"
      task_kind: "task" | "checkpoint"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["lemhi_admin", "msp_owner", "msp_member"],
      asset_category: [
        "recording",
        "transcript",
        "documentation",
        "marketing_asset",
        "link",
      ],
      asset_kind: ["file", "link"],
      asset_scope: ["program", "cohort", "msp"],
      asset_status: ["pending", "ready", "failed"],
      cohort_status: ["upcoming", "active", "ended"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      msp_status: ["active", "deactivated"],
      owner_type: ["msp", "lemhi"],
      session_kind: ["group", "one_on_one"],
      task_kind: ["task", "checkpoint"],
    },
  },
} as const
