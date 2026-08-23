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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          metadata: Json
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          metadata?: Json
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          metadata?: Json
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          case_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_kind: Database["public"]["Enums"]["event_kind"]
          external_ref: string | null
          id: string
          location: string | null
          organization_id: string
          source: Database["public"]["Enums"]["event_source"]
          starts_at: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          external_ref?: string | null
          id?: string
          location?: string | null
          organization_id: string
          source?: Database["public"]["Enums"]["event_source"]
          starts_at: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_kind?: Database["public"]["Enums"]["event_kind"]
          external_ref?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          source?: Database["public"]["Enums"]["event_source"]
          starts_at?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      case_assignees: {
        Row: {
          assignment_role: Database["public"]["Enums"]["assignment_role"]
          case_id: string
          created_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          case_id: string
          created_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          case_id?: string
          created_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_assignees_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_assignees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_id: string | null
          case_id: string
          content: string
          created_at: string
          id: string
          occurred_on: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          case_id: string
          content: string
          created_at?: string
          id?: string
          occurred_on?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          occurred_on?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_parties: {
        Row: {
          case_id: string
          contact: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["party_role"]
          updated_at: string
        }
        Insert: {
          case_id: string
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Update: {
          case_id?: string
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_parties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archived_at: string | null
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          case_number: string
          case_type: Database["public"]["Enums"]["case_type"]
          client_id: string
          closed_at: string | null
          court_department: string | null
          court_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          flat_fee_grosz: number | null
          flat_fee_included_minutes: number | null
          hourly_rate_grosz: number | null
          id: string
          lead_lawyer_id: string | null
          opened_at: string
          organization_id: string
          signature: string | null
          status: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          case_number: string
          case_type?: Database["public"]["Enums"]["case_type"]
          client_id: string
          closed_at?: string | null
          court_department?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flat_fee_grosz?: number | null
          flat_fee_included_minutes?: number | null
          hourly_rate_grosz?: number | null
          id?: string
          lead_lawyer_id?: string | null
          opened_at?: string
          organization_id: string
          signature?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          case_number?: string
          case_type?: Database["public"]["Enums"]["case_type"]
          client_id?: string
          closed_at?: string | null
          court_department?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flat_fee_grosz?: number | null
          flat_fee_included_minutes?: number | null
          hourly_rate_grosz?: number | null
          id?: string
          lead_lawyer_id?: string | null
          opened_at?: string
          organization_id?: string
          signature?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          billing_email: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          country_code: string
          created_at: string
          default_billing_model: Database["public"]["Enums"]["billing_model"]
          default_hourly_rate_grosz: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          relationship_owner_id: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          billing_email?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country_code?: string
          created_at?: string
          default_billing_model?: Database["public"]["Enums"]["billing_model"]
          default_hourly_rate_grosz?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          relationship_owner_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          billing_email?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country_code?: string
          created_at?: string
          default_billing_model?: Database["public"]["Enums"]["billing_model"]
          default_hourly_rate_grosz?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          relationship_owner_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          case_id: string | null
          created_at: string
          description: string
          gross_grosz: number
          id: string
          invoice_id: string
          net_grosz: number
          organization_id: string
          position: number
          quantity: number
          unit: string
          unit_price_net_grosz: number
          updated_at: string
          vat_grosz: number
          vat_rate: number
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          description: string
          gross_grosz?: number
          id?: string
          invoice_id: string
          net_grosz?: number
          organization_id: string
          position?: number
          quantity?: number
          unit?: string
          unit_price_net_grosz?: number
          updated_at?: string
          vat_grosz?: number
          vat_rate?: number
        }
        Update: {
          case_id?: string | null
          created_at?: string
          description?: string
          gross_grosz?: number
          id?: string
          invoice_id?: string
          net_grosz?: number
          organization_id?: string
          position?: number
          quantity?: number
          unit?: string
          unit_price_net_grosz?: number
          updated_at?: string
          vat_grosz?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          next_number: number
          organization_id: string
          year: number
        }
        Insert: {
          next_number?: number
          organization_id: string
          year: number
        }
        Update: {
          next_number?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          buyer_address: string | null
          buyer_name: string | null
          buyer_tax_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string | null
          ksef_error: string | null
          ksef_invoice_reference: string | null
          ksef_sent_at: string | null
          ksef_session_reference: string | null
          ksef_status: Database["public"]["Enums"]["ksef_status"]
          ksef_upo_xml: string | null
          notes: string | null
          number: string | null
          organization_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          period_from: string | null
          period_to: string | null
          sale_date: string | null
          seller_address: string | null
          seller_bank_account: string | null
          seller_name: string | null
          seller_tax_id: string | null
          sequence_number: number | null
          sequence_year: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_gross_grosz: number
          total_net_grosz: number
          total_vat_grosz: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_address?: string | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string | null
          ksef_error?: string | null
          ksef_invoice_reference?: string | null
          ksef_sent_at?: string | null
          ksef_session_reference?: string | null
          ksef_status?: Database["public"]["Enums"]["ksef_status"]
          ksef_upo_xml?: string | null
          notes?: string | null
          number?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          period_from?: string | null
          period_to?: string | null
          sale_date?: string | null
          seller_address?: string | null
          seller_bank_account?: string | null
          seller_name?: string | null
          seller_tax_id?: string | null
          sequence_number?: number | null
          sequence_year?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_gross_grosz?: number
          total_net_grosz?: number
          total_vat_grosz?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          buyer_address?: string | null
          buyer_name?: string | null
          buyer_tax_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string | null
          ksef_error?: string | null
          ksef_invoice_reference?: string | null
          ksef_sent_at?: string | null
          ksef_session_reference?: string | null
          ksef_status?: Database["public"]["Enums"]["ksef_status"]
          ksef_upo_xml?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          period_from?: string | null
          period_to?: string | null
          sale_date?: string | null
          seller_address?: string | null
          seller_bank_account?: string | null
          seller_name?: string | null
          seller_tax_id?: string | null
          sequence_number?: number | null
          sequence_year?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_gross_grosz?: number
          total_net_grosz?: number
          total_vat_grosz?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_rates: {
        Row: {
          created_at: string
          default_hourly_rate_grosz: number
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_hourly_rate_grosz?: number
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_hourly_rate_grosz?: number
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_rates_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: true
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account: string | null
          city: string | null
          country_code: string
          created_at: string
          default_payment_days: number
          default_vat_rate: number
          email: string | null
          id: string
          invoice_number_pattern: string
          legal_name: string | null
          name: string
          phone: string | null
          postal_code: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          default_payment_days?: number
          default_vat_rate?: number
          email?: string | null
          id?: string
          invoice_number_pattern?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          default_payment_days?: number
          default_vat_rate?: number
          email?: string | null
          id?: string
          invoice_number_pattern?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          task_kind: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_kind?: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_kind?: Database["public"]["Enums"]["task_kind"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          billing_type: Database["public"]["Enums"]["billing_model"]
          case_id: string
          created_at: string
          description: string
          id: string
          invoice_id: string | null
          locked_at: string | null
          minutes: number
          organization_id: string
          rate_snapshot_grosz: number
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          billable?: boolean
          billing_type: Database["public"]["Enums"]["billing_model"]
          case_id: string
          created_at?: string
          description: string
          id?: string
          invoice_id?: string | null
          locked_at?: string | null
          minutes: number
          organization_id: string
          rate_snapshot_grosz?: number
          updated_at?: string
          user_id: string
          work_date?: string
        }
        Update: {
          billable?: boolean
          billing_type?: Database["public"]["Enums"]["billing_model"]
          case_id?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string | null
          locked_at?: string | null
          minutes?: number
          organization_id?: string
          rate_snapshot_grosz?: number
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_directory_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      any_organization_exists: { Args: never; Returns: boolean }
      approve_invoice: {
        Args: { p_invoice: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          buyer_address: string | null
          buyer_name: string | null
          buyer_tax_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string | null
          ksef_error: string | null
          ksef_invoice_reference: string | null
          ksef_sent_at: string | null
          ksef_session_reference: string | null
          ksef_status: Database["public"]["Enums"]["ksef_status"]
          ksef_upo_xml: string | null
          notes: string | null
          number: string | null
          organization_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          period_from: string | null
          period_to: string | null
          sale_date: string | null
          seller_address: string | null
          seller_bank_account: string | null
          seller_name: string | null
          seller_tax_id: string | null
          sequence_number: number | null
          sequence_year: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_gross_grosz: number
          total_net_grosz: number
          total_vat_grosz: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_organization: { Args: { p_name: string }; Returns: string }
      can_access_case: { Args: { p_case: string }; Returns: boolean }
      can_see_finances: { Args: { p_org: string }; Returns: boolean }
      cancel_invoice: {
        Args: { p_invoice: string; p_reason?: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          buyer_address: string | null
          buyer_name: string | null
          buyer_tax_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string | null
          ksef_error: string | null
          ksef_invoice_reference: string | null
          ksef_sent_at: string | null
          ksef_session_reference: string | null
          ksef_status: Database["public"]["Enums"]["ksef_status"]
          ksef_upo_xml: string | null
          notes: string | null
          number: string | null
          organization_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          period_from: string | null
          period_to: string | null
          sale_date: string | null
          seller_address: string | null
          seller_bank_account: string | null
          seller_name: string | null
          seller_tax_id: string | null
          sequence_number: number | null
          sequence_year: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_gross_grosz: number
          total_net_grosz: number
          total_vat_grosz: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deactivate_member: {
        Args: { p_email: string; p_org: string }
        Returns: undefined
      }
      format_invoice_number: {
        Args: {
          p_month: number
          p_number: number
          p_pattern: string
          p_year: number
        }
        Returns: string
      }
      has_role_in: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_member_of: { Args: { p_org: string }; Returns: boolean }
      is_owner_of: { Args: { p_org: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_entity?: string
          p_entity_id?: string
          p_metadata?: Json
          p_org: string
        }
        Returns: undefined
      }
      my_org_ids: { Args: never; Returns: string[] }
      my_role_in: {
        Args: { p_org: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      next_invoice_number: {
        Args: { p_org: string; p_year: number }
        Returns: number
      }
      organization_member_directory: {
        Args: { p_org: string }
        Returns: {
          active: boolean
          created_at: string
          display_name: string
          email: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }[]
      }
      resolve_billing_model: {
        Args: { p_case: string }
        Returns: Database["public"]["Enums"]["billing_model"]
      }
      resolve_hourly_rate: {
        Args: { p_case: string; p_user: string }
        Returns: number
      }
      resolve_hourly_rate_internal: {
        Args: { p_case: string; p_user: string }
        Returns: number
      }
      safe_uuid: { Args: { p_text: string }; Returns: string }
      set_member_role: {
        Args: {
          p_email: string
          p_org: string
          p_role: Database["public"]["Enums"]["org_role"]
        }
        Returns: string
      }
      shares_org_with: { Args: { p_user: string }; Returns: boolean }
      storage_case_id: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      assignment_role: "lead" | "member"
      billing_model: "godzinowy" | "ryczalt" | "nieodplatny"
      case_status: "aktywna" | "zawieszona" | "zakonczona"
      case_type:
        | "spor_sadowy"
        | "spor_pozasadowy"
        | "opinia"
        | "umowa"
        | "obsluga_korporacyjna"
        | "inna"
      client_type: "osoba_fizyczna" | "firma"
      event_kind:
        | "rozprawa"
        | "posiedzenie"
        | "termin_procesowy"
        | "spotkanie"
        | "inne"
      event_source: "manual" | "pi_import"
      invoice_status: "draft" | "approved" | "sent" | "paid" | "anulowana"
      ksef_status: "not_sent" | "pending" | "accepted" | "error"
      org_role: "owner" | "partner" | "lawyer" | "staff"
      party_role:
        | "powod"
        | "pozwany"
        | "uczestnik"
        | "pelnomocnik_drugiej_strony"
        | "inny"
      payment_method: "przelew" | "gotowka" | "karta" | "inna"
      task_kind: "zadanie" | "brak_formalny"
      task_priority: "niski" | "normalny" | "wysoki" | "pilny"
      task_status: "do_zrobienia" | "w_toku" | "zrobione" | "anulowane"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      assignment_role: ["lead", "member"],
      billing_model: ["godzinowy", "ryczalt", "nieodplatny"],
      case_status: ["aktywna", "zawieszona", "zakonczona"],
      case_type: [
        "spor_sadowy",
        "spor_pozasadowy",
        "opinia",
        "umowa",
        "obsluga_korporacyjna",
        "inna",
      ],
      client_type: ["osoba_fizyczna", "firma"],
      event_kind: [
        "rozprawa",
        "posiedzenie",
        "termin_procesowy",
        "spotkanie",
        "inne",
      ],
      event_source: ["manual", "pi_import"],
      invoice_status: ["draft", "approved", "sent", "paid", "anulowana"],
      ksef_status: ["not_sent", "pending", "accepted", "error"],
      org_role: ["owner", "partner", "lawyer", "staff"],
      party_role: [
        "powod",
        "pozwany",
        "uczestnik",
        "pelnomocnik_drugiej_strony",
        "inny",
      ],
      payment_method: ["przelew", "gotowka", "karta", "inna"],
      task_kind: ["zadanie", "brak_formalny"],
      task_priority: ["niski", "normalny", "wysoki", "pilny"],
      task_status: ["do_zrobienia", "w_toku", "zrobione", "anulowane"],
    },
  },
} as const

