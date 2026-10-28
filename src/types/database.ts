
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assets": {
                  Row: {
                    "acquisition_cost": number | null,"acquisition_date": string | null,"asset_tag": string,"category_id": string | null,"condition": Database["public"]['Enums']["asset_condition"] | null,"created_at": string,"created_by": string | null,"custom_fields": NonNullable<Json>,"deleted_at": string | null,"description": string | null,"funding_source": string | null,"id": string,"image_path": string | null,"kind": Database["public"]['Enums']["asset_kind"],"location_id": string | null,"manufacturer": string | null,"model": string | null,"name": string,"notes": string | null,"retired_at": string | null,"search_vector": unknown,"serial_number": string | null,"status": Database["public"]['Enums']["asset_status"],"updated_at": string | null,"vendor": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acquisition_cost"?: number | null,"acquisition_date"?: string | null,"asset_tag"?: string,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["asset_condition"] | null,"created_at"?: string,"created_by"?: string | null,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: string | null,"funding_source"?: string | null,"id"?: string,"image_path"?: string | null,"kind": Database["public"]['Enums']["asset_kind"],"location_id"?: string | null,"manufacturer"?: string | null,"model"?: string | null,"name": string,"notes"?: string | null,"retired_at"?: string | null,"search_vector"?: never,"serial_number"?: string | null,"status"?: Database["public"]['Enums']["asset_status"],"updated_at"?: string | null,"vendor"?: string | null
                  }
                  Update: {
                    "acquisition_cost"?: number | null,"acquisition_date"?: string | null,"asset_tag"?: string,"category_id"?: string | null,"condition"?: Database["public"]['Enums']["asset_condition"] | null,"created_at"?: string,"created_by"?: string | null,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: string | null,"funding_source"?: string | null,"id"?: string,"image_path"?: string | null,"kind"?: Database["public"]['Enums']["asset_kind"],"location_id"?: string | null,"manufacturer"?: string | null,"model"?: string | null,"name"?: string,"notes"?: string | null,"retired_at"?: string | null,"search_vector"?: never,"serial_number"?: string | null,"status"?: Database["public"]['Enums']["asset_status"],"updated_at"?: string | null,"vendor"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"asset_id": string | null,"changes": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"id": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"asset_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: string,"summary"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"asset_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"custom_field_schema": NonNullable<Json>,"id": string,"kind": Database["public"]['Enums']["asset_kind"],"name": string,"parent_id": string | null,"updated_at": string | null,"useful_life_years": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"custom_field_schema"?: NonNullable<Json>,"id"?: string,"kind": Database["public"]['Enums']["asset_kind"],"name": string,"parent_id"?: string | null,"updated_at"?: string | null,"useful_life_years"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"custom_field_schema"?: NonNullable<Json>,"id"?: string,"kind"?: Database["public"]['Enums']["asset_kind"],"name"?: string,"parent_id"?: string | null,"updated_at"?: string | null,"useful_life_years"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"checkouts": {
                  Row: {
                    "asset_id": string,"asset_kind": Database["public"]['Enums']["asset_kind"],"borrower_name": string,"borrower_ref": string | null,"borrower_type": Database["public"]['Enums']["borrower_type"],"checked_out_at": string,"checked_out_by": string | null,"condition_in": Database["public"]['Enums']["asset_condition"] | null,"condition_out": Database["public"]['Enums']["asset_condition"] | null,"created_at": string,"due_at": string | null,"id": string,"notes": string | null,"returned_at": string | null,"returned_to": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"asset_kind": Database["public"]['Enums']["asset_kind"],"borrower_name": string,"borrower_ref"?: string | null,"borrower_type": Database["public"]['Enums']["borrower_type"],"checked_out_at"?: string,"checked_out_by"?: string | null,"condition_in"?: Database["public"]['Enums']["asset_condition"] | null,"condition_out"?: Database["public"]['Enums']["asset_condition"] | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"notes"?: string | null,"returned_at"?: string | null,"returned_to"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "asset_id"?: string,"asset_kind"?: Database["public"]['Enums']["asset_kind"],"borrower_name"?: string,"borrower_ref"?: string | null,"borrower_type"?: Database["public"]['Enums']["borrower_type"],"checked_out_at"?: string,"checked_out_by"?: string | null,"condition_in"?: Database["public"]['Enums']["asset_condition"] | null,"condition_out"?: Database["public"]['Enums']["asset_condition"] | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"notes"?: string | null,"returned_at"?: string | null,"returned_to"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkouts_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkouts_checked_out_by_fkey"
      columns: ["checked_out_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkouts_returned_to_fkey"
      columns: ["returned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"digital_licenses": {
                  Row: {
                    "admin_contact": string | null,"asset_id": string,"billing_cycle": Database["public"]['Enums']["billing_cycle"],"contract_number": string | null,"cost_per_period": number | null,"created_at": string,"expires_at": string | null,"license_key_hint": string | null,"license_type": Database["public"]['Enums']["license_type"],"platform_url": string | null,"renewal_date": string | null,"seats_total": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_contact"?: string | null,"asset_id": string,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"contract_number"?: string | null,"cost_per_period"?: number | null,"created_at"?: string,"expires_at"?: string | null,"license_key_hint"?: string | null,"license_type"?: Database["public"]['Enums']["license_type"],"platform_url"?: string | null,"renewal_date"?: string | null,"seats_total"?: number | null,"updated_at"?: string | null
                  }
                  Update: {
                    "admin_contact"?: string | null,"asset_id"?: string,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"contract_number"?: string | null,"cost_per_period"?: number | null,"created_at"?: string,"expires_at"?: string | null,"license_key_hint"?: string | null,"license_type"?: Database["public"]['Enums']["license_type"],"platform_url"?: string | null,"renewal_date"?: string | null,"seats_total"?: number | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "digital_licenses_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: true
      referencedRelation: "assets"
      referencedColumns: ["id"]
    }
                  ]
                },"institution_settings": {
                  Row: {
                    "asset_tag_prefix": string,"created_at": string,"default_loan_days": number,"depreciation_method": string,"fiscal_year_start_month": number,"id": string,"logo_path": string | null,"name": string,"singleton": boolean,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_tag_prefix"?: string,"created_at"?: string,"default_loan_days"?: number,"depreciation_method"?: string,"fiscal_year_start_month"?: number,"id"?: string,"logo_path"?: string | null,"name"?: string,"singleton"?: boolean,"updated_at"?: string | null
                  }
                  Update: {
                    "asset_tag_prefix"?: string,"created_at"?: string,"default_loan_days"?: number,"depreciation_method"?: string,"fiscal_year_start_month"?: number,"id"?: string,"logo_path"?: string | null,"name"?: string,"singleton"?: boolean,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"locations": {
                  Row: {
                    "building": string | null,"created_at": string,"id": string,"manager_id": string | null,"name": string,"room": string | null,"type": Database["public"]['Enums']["location_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "building"?: string | null,"created_at"?: string,"id"?: string,"manager_id"?: string | null,"name": string,"room"?: string | null,"type"?: Database["public"]['Enums']["location_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "building"?: string | null,"created_at"?: string,"id"?: string,"manager_id"?: string | null,"name"?: string,"room"?: string | null,"type"?: Database["public"]['Enums']["location_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_manager_id_fkey"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"metric_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"duration_ms": number,"id": string,"kind": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"duration_ms": number,"id"?: string,"kind": string,"updated_at"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"duration_ms"?: number,"id"?: string,"kind"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "metric_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"department": string | null,"email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["user_role"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department"?: string | null,"email": string,"full_name"?: string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"report_runs": {
                  Row: {
                    "created_at": string,"duration_ms": number,"file_path": string | null,"format": Database["public"]['Enums']["report_format"],"generated_by": string | null,"id": string,"params": NonNullable<Json>,"report_type": string,"row_count": number,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_ms"?: number,"file_path"?: string | null,"format": Database["public"]['Enums']["report_format"],"generated_by"?: string | null,"id"?: string,"params"?: NonNullable<Json>,"report_type": string,"row_count"?: number,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"duration_ms"?: number,"file_path"?: string | null,"format"?: Database["public"]['Enums']["report_format"],"generated_by"?: string | null,"id"?: string,"params"?: NonNullable<Json>,"report_type"?: string,"row_count"?: number,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_runs_generated_by_fkey"
      columns: ["generated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_clear_inventory":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_load_demo_data":
{ Args: { "p": Json }; Returns: Json
                           },
"borrower_label":
{ Args: { "p_name": string,"p_ref": string,"p_type": Database["public"]['Enums']["borrower_type"] }; Returns: string
                           },
"check_in_asset":
{ Args: { "p_checkout_id": string,"p_condition_in"?: Database["public"]['Enums']["asset_condition"],"p_notes"?: string }; Returns: undefined
                           },
"check_out_asset":
{ Args: { "p_asset_id": string,"p_borrower_name": string,"p_borrower_ref"?: string,"p_borrower_type": Database["public"]['Enums']["borrower_type"],"p_condition_out"?: Database["public"]['Enums']["asset_condition"],"p_due_at"?: string,"p_notes"?: string }; Returns: string
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"f_unaccent":
{ Args: { "": string }; Returns: string
                           },
"find_possible_duplicates":
{ Args: { "p_exclude_id"?: string,"p_model"?: string,"p_name"?: string,"p_serial"?: string }; Returns: {
              "asset_tag": string,"id": string,"model": string,"name": string,"reason": string,"score": number,"serial_number": string
            }[]
                           },
"has_any_role":
{ Args: { "roles": (Database["public"]['Enums']["user_role"])[] }; Returns: boolean
                           },
"import_assets":
{ Args: { "p_rows": Json }; Returns: number
                           },
"jsonb_diff":
{ Args: { "p_new": Json,"p_old": Json }; Returns: Json
                           },
"next_asset_tag":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"save_asset":
{ Args: { "p_asset": Json,"p_id": string,"p_license"?: Json }; Returns: {
              "asset_tag": string,"id": string
            }[]
                           },
"search_assets":
{ Args: { "dir"?: string,"filters"?: Json,"page"?: number,"page_size"?: number,"q"?: string,"sort"?: string }; Returns: {
              "acquisition_cost": number,"acquisition_date": string,"asset_tag": string,"category_id": string,"category_name": string,"condition": Database["public"]['Enums']["asset_condition"],"due_at": string,"funding_source": string,"holder": string,"id": string,"image_path": string,"kind": Database["public"]['Enums']["asset_kind"],"location_id": string,"location_name": string,"manufacturer": string,"model": string,"name": string,"rank": number,"seats_total": number,"seats_used": number,"serial_number": string,"status": Database["public"]['Enums']["asset_status"],"total_count": number
            }[]
                           }
          }
          Enums: {
            "asset_condition": "new"|"good"|"fair"|"poor"|"broken","asset_kind": "physical"|"digital","asset_status": "available"|"checked_out"|"in_repair"|"retired"|"lost","billing_cycle": "monthly"|"annual"|"multi_year"|"one_time","borrower_type": "student"|"staff"|"classroom","license_type": "per_seat"|"site"|"subscription","location_type": "classroom"|"library"|"office"|"storage"|"lab"|"other","report_format": "pdf"|"xlsx"|"csv","user_role": "admin"|"manager"|"staff"|"viewer"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "asset_condition": ["new", "good", "fair", "poor", "broken"],"asset_kind": ["physical", "digital"],"asset_status": ["available", "checked_out", "in_repair", "retired", "lost"],"billing_cycle": ["monthly", "annual", "multi_year", "one_time"],"borrower_type": ["student", "staff", "classroom"],"license_type": ["per_seat", "site", "subscription"],"location_type": ["classroom", "library", "office", "storage", "lab", "other"],"report_format": ["pdf", "xlsx", "csv"],"user_role": ["admin", "manager", "staff", "viewer"]
          }
        }
} as const
