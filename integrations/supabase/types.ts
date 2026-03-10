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
    PostgrestVersion: "14.1"
  }
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
      admin_users: {
        Row: {
          business_logo: string | null
          business_name: string
          created_at: string
          id: string
          notes: string | null
          role: string
          updated_at: string
        }
        Insert: {
          business_logo?: string | null
          business_name?: string
          created_at?: string
          id: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          business_logo?: string | null
          business_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          anon_id: string | null
          created_at: string | null
          customer_id: string | null
          event_type: string | null
          id: string
          location_id: string | null
          payload: Json | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          event_type?: string | null
          id?: string
          location_id?: string | null
          payload?: Json | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          event_type?: string | null
          id?: string
          location_id?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
      customer_tags: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          session_id: string
          source: string | null
          store_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_id: string
          source?: string | null
          store_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          session_id?: string
          source?: string | null
          store_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_visits: {
        Row: {
          customer_id: string | null
          id: string
          location_id: string | null
          profile_at_visit: string | null
          skus_shown: string[] | null
          visited_at: string | null
          zones_scanned: string[] | null
        }
        Insert: {
          customer_id?: string | null
          id?: string
          location_id?: string | null
          profile_at_visit?: string | null
          skus_shown?: string[] | null
          visited_at?: string | null
          zones_scanned?: string[] | null
        }
        Update: {
          customer_id?: string | null
          id?: string
          location_id?: string | null
          profile_at_visit?: string | null
          skus_shown?: string[] | null
          visited_at?: string | null
          zones_scanned?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_visits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          anon_id: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          last_active: string | null
          last_seen: string | null
          location_id: string | null
          name: string | null
          phone: string | null
          skus_shown_all: string[] | null
          store_id: string | null
          traits: Json | null
          updated_at: string | null
          visit_count: number | null
          zones_saved: string[] | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          last_seen?: string | null
          location_id?: string | null
          name?: string | null
          phone?: string | null
          skus_shown_all?: string[] | null
          store_id?: string | null
          traits?: Json | null
          updated_at?: string | null
          visit_count?: number | null
          zones_saved?: string[] | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_active?: string | null
          last_seen?: string | null
          location_id?: string | null
          name?: string | null
          phone?: string | null
          skus_shown_all?: string[] | null
          store_id?: string | null
          traits?: Json | null
          updated_at?: string | null
          visit_count?: number | null
          zones_saved?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_session_nodes: {
        Row: {
          id: string
          session_id: string
          form_id: string
          node_id: string
          entered_at: string
          exited_at: string | null
          time_spent_seconds: number | null
          is_dropoff: boolean | null
        }
        Insert: {
          id?: string
          session_id: string
          form_id: string
          node_id: string
          entered_at?: string
          exited_at?: string | null
          time_spent_seconds?: number | null
          is_dropoff?: boolean | null
        }
        Update: {
          id?: string
          session_id?: string
          form_id?: string
          node_id?: string
          entered_at?: string
          exited_at?: string | null
          time_spent_seconds?: number | null
          is_dropoff?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_session_nodes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_session_nodes_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_sessions: {
        Row: {
          browser: string | null
          city: string | null
          completed_at: string | null
          country: string | null
          current_node_id: string | null
          device_type: string | null
          drop_off_node_id: string | null
          flow_version: string | null
          form_id: string
          id: string
          last_activity_at: string
          os: string | null
          partial_answers: Json
          region: string | null
          response_id: string | null
          started_at: string
          status: string
          total_time_seconds: number | null
          visited_nodes: Json
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          completed_at?: string | null
          country?: string | null
          current_node_id?: string | null
          device_type?: string | null
          drop_off_node_id?: string | null
          flow_version?: string | null
          form_id: string
          id?: string
          last_activity_at?: string
          os?: string | null
          partial_answers?: Json
          region?: string | null
          response_id?: string | null
          started_at?: string
          status?: string
          total_time_seconds?: number | null
          visited_nodes?: Json
          visitor_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          completed_at?: string | null
          country?: string | null
          current_node_id?: string | null
          device_type?: string | null
          drop_off_node_id?: string | null
          flow_version?: string | null
          form_id?: string
          id?: string
          last_activity_at?: string
          os?: string | null
          partial_answers?: Json
          region?: string | null
          response_id?: string | null
          started_at?: string
          status?: string
          total_time_seconds?: number | null
          visited_nodes?: Json
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_sessions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      form_visits: {
        Row: {
          form_id: string
          id: string
          is_return_visitor: boolean | null
          referrer: string | null
          user_agent: string | null
          visited_at: string
          visitor_id: string
          zone_id: string | null
        }
        Insert: {
          form_id: string
          id?: string
          is_return_visitor?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          visited_at?: string
          visitor_id: string
          zone_id?: string | null
        }
        Update: {
          form_id?: string
          id?: string
          is_return_visitor?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          visited_at?: string
          visitor_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_visits_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_visits_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_visits_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          capture_email: boolean
          capture_name: boolean
          capture_phone: boolean
          created_at: string
          flow_type: string | null
          flow_version: string | null
          id: string
          internal_goal: string | null
          name: string
          owner_id: string
          perk: string
          questions: Json
          show_start_page: boolean
          store_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          active?: boolean
          capture_email?: boolean
          capture_name?: boolean
          capture_phone?: boolean
          created_at?: string
          flow_type?: string | null
          flow_version?: string | null
          id?: string
          internal_goal?: string | null
          name: string
          owner_id: string
          perk: string
          questions?: Json
          show_start_page?: boolean
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          active?: boolean
          capture_email?: boolean
          capture_name?: boolean
          capture_phone?: boolean
          created_at?: string
          flow_type?: string | null
          flow_version?: string | null
          id?: string
          internal_goal?: string | null
          name?: string
          owner_id?: string
          perk?: string
          questions?: Json
          show_start_page?: boolean
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          session_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          session_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "interactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          display_name: string | null
          id: string
          qr_entry_code: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          display_name?: string | null
          id: string
          qr_entry_code?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          display_name?: string | null
          id?: string
          qr_entry_code?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "saves_without_purchase"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string
          deleted_at: string | null
          description: string | null
          featured_from: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          is_staff_pick: boolean | null
          lightspeed_sku_id: string | null
          name: string
          owner_id: string
          price: number | null
          sku: string | null
          store_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          featured_from?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          is_staff_pick?: boolean | null
          lightspeed_sku_id?: string | null
          name: string
          owner_id: string
          price?: number | null
          sku?: string | null
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          featured_from?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          is_staff_pick?: boolean | null
          lightspeed_sku_id?: string | null
          name?: string
          owner_id?: string
          price?: number | null
          sku?: string | null
          store_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_rules: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          profile_id: string
          question: string
          weight: number
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          profile_id: string
          question: string
          weight: number
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          question?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_default: boolean | null
          zones: string[] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id: string
          is_default?: boolean | null
          zones?: string[] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_default?: boolean | null
          zones?: string[] | null
        }
        Relationships: []
      }
      responses: {
        Row: {
          additional_feedback: string | null
          answers: Json
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          form_id: string
          id: string
          notes: string | null
          perk_redeemed: boolean
          redemption_code: string
          submitted_at: string
        }
        Insert: {
          additional_feedback?: string | null
          answers?: Json
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_id: string
          id?: string
          notes?: string | null
          perk_redeemed?: boolean
          redemption_code: string
          submitted_at?: string
        }
        Update: {
          additional_feedback?: string | null
          answers?: Json
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_id?: string
          id?: string
          notes?: string | null
          perk_redeemed?: boolean
          redemption_code?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          product_id: string
          purchased_at: string | null
          session_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          product_id: string
          purchased_at?: string | null
          session_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          product_id?: string
          purchased_at?: string | null
          session_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "saved_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "saves_without_purchase"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "saved_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_profile_copy: {
        Row: {
          copy_override: string | null
          profile_id: string
          sku_id: string
        }
        Insert: {
          copy_override?: string | null
          profile_id: string
          sku_id: string
        }
        Update: {
          copy_override?: string | null
          profile_id?: string
          sku_id?: string
        }
        Relationships: []
      }
      store_integrations: {
        Row: {
          api_key: string
          created_at: string
          id: string
          platform: string
          store_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          platform: string
          store_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          platform?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          created_at: string
          product_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "saves_without_purchase"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_hard_constraint: boolean | null
          name: string
          store_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_hard_constraint?: boolean | null
          name: string
          store_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_hard_constraint?: boolean | null
          name?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_location_journeys: {
        Row: {
          customer_id: string | null
          id: string
          session_id: string | null
          store_id: string | null
          visited_at: string
          visitor_id: string
        }
        Insert: {
          customer_id?: string | null
          id?: string
          session_id?: string | null
          store_id?: string | null
          visited_at?: string
          visitor_id: string
        }
        Update: {
          customer_id?: string | null
          id?: string
          session_id?: string | null
          store_id?: string | null
          visited_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "visitor_location_journeys_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_store_config: {
        Row: {
          location_description: string | null
          location_id: string
          zone_id: string
        }
        Insert: {
          location_description?: string | null
          location_id: string
          zone_id: string
        }
        Update: {
          location_description?: string | null
          location_id?: string
          zone_id?: string
        }
        Relationships: []
      }
      zone_tags: {
        Row: {
          tag_id: string
          zone_id: string
        }
        Insert: {
          tag_id: string
          zone_id: string
        }
        Update: {
          tag_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_tags_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          store_id: string
          updated_at: string
          zone_what: string | null
          zone_when: string | null
          zone_who: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          store_id: string
          updated_at?: string
          zone_what?: string | null
          zone_when?: string | null
          zone_who?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          store_id?: string
          updated_at?: string
          zone_what?: string | null
          zone_when?: string | null
          zone_who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cross_location_visitors: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          email: string | null
          journey: Json | null
          phone: string | null
          stores_visited: number | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "visitor_location_journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      flow_reentries: {
        Row: {
          abandonments: number | null
          completions: number | null
          first_visit: string | null
          flow_name: string | null
          form_id: string | null
          last_visit: string | null
          store_id: string | null
          total_sessions: number | null
          visitor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_sessions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_sessions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "public_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lapsed_visitors: {
        Row: {
          customer_id: string | null
          days_since_visit: number | null
          email: string | null
          last_active: string | null
          name: string | null
          phone: string | null
          store_id: string | null
          traits: Json | null
          visit_count: number | null
        }
        Insert: {
          customer_id?: string | null
          days_since_visit?: never
          email?: string | null
          last_active?: string | null
          name?: string | null
          phone?: string | null
          store_id?: string | null
          traits?: Json | null
          visit_count?: never
        }
        Update: {
          customer_id?: string | null
          days_since_visit?: never
          email?: string | null
          last_active?: string | null
          name?: string | null
          phone?: string | null
          store_id?: string | null
          traits?: Json | null
          visit_count?: never
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      public_forms: {
        Row: {
          active: boolean | null
          capture_email: boolean | null
          capture_name: boolean | null
          capture_phone: boolean | null
          created_at: string | null
          id: string | null
          name: string | null
          perk: string | null
          questions: Json | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          capture_email?: boolean | null
          capture_name?: boolean | null
          capture_phone?: boolean | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          perk?: string | null
          questions?: Json | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          capture_email?: boolean | null
          capture_name?: boolean | null
          capture_phone?: boolean | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          perk?: string | null
          questions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      remarketing_contacts: {
        Row: {
          completed_flow: boolean | null
          customer_id: string | null
          email: string | null
          is_cross_location: boolean | null
          is_vip: boolean | null
          last_active: string | null
          name: string | null
          opted_in_at: string | null
          phone: string | null
          saved_item_count: number | null
          saves_without_purchase: number | null
          store_id: string | null
          traits: Json | null
          visit_count: number | null
        }
        Insert: {
          completed_flow?: never
          customer_id?: string | null
          email?: string | null
          is_cross_location?: never
          is_vip?: never
          last_active?: string | null
          name?: string | null
          opted_in_at?: string | null
          phone?: string | null
          saved_item_count?: never
          saves_without_purchase?: never
          store_id?: string | null
          traits?: Json | null
          visit_count?: never
        }
        Update: {
          completed_flow?: never
          customer_id?: string | null
          email?: string | null
          is_cross_location?: never
          is_vip?: never
          last_active?: string | null
          name?: string | null
          opted_in_at?: string | null
          phone?: string | null
          saved_item_count?: never
          saves_without_purchase?: never
          store_id?: string | null
          traits?: Json | null
          visit_count?: never
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      saves_without_purchase: {
        Row: {
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          days_since_saved: number | null
          image_url: string | null
          price: number | null
          product_id: string | null
          product_name: string | null
          purchased_at: string | null
          save_id: string | null
          saved_at: string | null
          sku: string | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lapsed_visitors"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "saved_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "remarketing_contacts"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "saved_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_form_metrics: { Args: { p_form_ids: string[] }; Returns: Json }
      get_form_profile: {
        Args: { form_id_param: string }
        Returns: {
          business_logo: string
          business_name: string
        }[]
      }
      get_location_metrics: { Args: { p_store_id: string }; Returns: Json }
      get_touchpoint_metrics: { Args: { p_form_id: string }; Returns: Json }
      get_visitor_sessions: {
        Args: { p_store_id: string; p_visitor_id: string }
        Returns: Json
      }
      link_anonymous_session: {
        Args: {
          p_customer_id: string
          p_session_id: string
          p_store_id: string
        }
        Returns: undefined
      }
      merge_customer_traits: {
        Args: {
          p_email: string
          p_name: string
          p_new_traits: Json
          p_phone: string
          p_store_id: string
        }
        Returns: string
      }
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
    Enums: {},
  },
} as const
