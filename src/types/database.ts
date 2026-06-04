export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  showroom: {
    Tables: {
      site_settings: {
        Row: {
          id: string
          site_title: string
          site_description: string | null
          og_image_url: string | null
          reservation_url: string | null
          store_url: string | null
          hero_enabled: boolean
          hero_video_url: string | null
          hero_mobile_video_url: string | null
          hero_title: string | null
          hero_subtitle: string | null
          hero_description: string | null
          hero_slide_interval: number
          hero_slide_transition: string | null
          card_text_position: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          site_title?: string
          site_description?: string | null
          og_image_url?: string | null
          reservation_url?: string | null
          store_url?: string | null
          hero_enabled?: boolean
          hero_video_url?: string | null
          hero_mobile_video_url?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          hero_slide_interval?: number
          hero_slide_transition?: string | null
          card_text_position?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          site_title?: string
          site_description?: string | null
          og_image_url?: string | null
          reservation_url?: string | null
          store_url?: string | null
          hero_enabled?: boolean
          hero_video_url?: string | null
          hero_mobile_video_url?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          hero_slide_interval?: number
          hero_slide_transition?: string | null
          card_text_position?: string | null
          updated_at?: string
        }
      }
      nodes: {
        Row: {
          id: string
          parent_id: string | null
          type: string
          name: string
          slug: string
          status: string
          display_order: number
          image_url: string | null
          card_subtitle: string | null
          hero_enabled: boolean
          hero_video_url: string | null
          hero_mobile_video_url: string | null
          hero_title: string | null
          hero_subtitle: string | null
          hero_description: string | null
          hero_slide_interval: number
          hero_slide_transition: string | null
          tagline: string | null
          description: string | null
          card_text_position: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id?: string | null
          type: string
          name: string
          slug: string
          status?: string
          display_order?: number
          image_url?: string | null
          card_subtitle?: string | null
          hero_enabled?: boolean
          hero_video_url?: string | null
          hero_mobile_video_url?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          hero_slide_interval?: number
          hero_slide_transition?: string | null
          tagline?: string | null
          description?: string | null
          card_text_position?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string | null
          type?: string
          name?: string
          slug?: string
          status?: string
          display_order?: number
          image_url?: string | null
          card_subtitle?: string | null
          hero_enabled?: boolean
          hero_video_url?: string | null
          hero_mobile_video_url?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          hero_slide_interval?: number
          hero_slide_transition?: string | null
          tagline?: string | null
          description?: string | null
          card_text_position?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      hero_media: {
        Row: {
          id: string
          node_id: string
          image_url: string
          mobile_image_url: string | null
          device_type: string
          media_type: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          node_id: string
          image_url: string
          mobile_image_url?: string | null
          device_type?: string
          media_type?: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          node_id?: string
          image_url?: string
          mobile_image_url?: string | null
          device_type?: string
          media_type?: string
          display_order?: number
          created_at?: string
        }
      }
      site_hero_media: {
        Row: {
          id: string
          image_url: string
          mobile_image_url: string | null
          device_type: string
          media_type: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          image_url: string
          mobile_image_url?: string | null
          device_type?: string
          media_type?: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          mobile_image_url?: string | null
          device_type?: string
          media_type?: string
          display_order?: number
          created_at?: string
        }
      }
      gallery_photos: {
        Row: {
          id: string
          node_id: string
          image_url: string
          caption: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          node_id: string
          image_url: string
          caption?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          node_id?: string
          image_url?: string
          caption?: string | null
          display_order?: number
          created_at?: string
        }
      }
      preview_tokens: {
        Row: {
          id: string
          node_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          node_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          node_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
      }
    }
  }
  platform: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'customer' | 'sales_manager' | 'administrator'
          display_name: string | null
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'customer' | 'sales_manager' | 'administrator'
          display_name?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'customer' | 'sales_manager' | 'administrator'
          display_name?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      staff_profiles: {
        Row: {
          profile_id: string
          team_name: string | null
          public_name: string
          work_phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          team_name?: string | null
          public_name: string
          work_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          team_name?: string | null
          public_name?: string
          work_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      measurement_requests: {
        Row: {
          id: string
          customer_id: string
          customer_name: string
          phone: string
          address: string
          address_detail: string | null
          interest_category: 'middle_door' | 'abs_door' | 'front_door' | 'molding_baseboard' | 'other'
          message: string
          preferred_schedule: string | null
          status: 'submitted' | 'appsheet_pending' | 'appsheet_registered' | 'contacted' | 'assigned' | 'scheduled' | 'measured' | 'cancelled'
          appsheet_status: 'pending' | 'registered' | 'skipped'
          privacy_agreed_at: string
          created_at: string
          updated_at: string
          postcode: string | null
          road_address: string | null
          jibun_address: string | null
          address_extra: string | null
          preferred_visit_date: string | null
          preferred_visit_time_slot: string | null
          interest_categories: string[] | null
          is_manual_address: boolean
          referrer_name: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          customer_name: string
          phone: string
          address: string
          address_detail?: string | null
          interest_category?: 'middle_door' | 'abs_door' | 'front_door' | 'molding_baseboard' | 'other'
          message: string
          preferred_schedule?: string | null
          status?: 'submitted' | 'appsheet_pending' | 'appsheet_registered' | 'contacted' | 'assigned' | 'scheduled' | 'measured' | 'cancelled'
          appsheet_status?: 'pending' | 'registered' | 'skipped'
          privacy_agreed_at?: string
          created_at?: string
          updated_at?: string
          postcode?: string | null
          road_address?: string | null
          jibun_address?: string | null
          address_extra?: string | null
          preferred_visit_date?: string | null
          preferred_visit_time_slot?: string | null
          interest_categories?: string[] | null
          is_manual_address?: boolean
          referrer_name?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          customer_name?: string
          phone?: string
          address?: string
          address_detail?: string | null
          interest_category?: 'middle_door' | 'abs_door' | 'front_door' | 'molding_baseboard' | 'other'
          message?: string
          preferred_schedule?: string | null
          status?: 'submitted' | 'appsheet_pending' | 'appsheet_registered' | 'contacted' | 'assigned' | 'scheduled' | 'measured' | 'cancelled'
          appsheet_status?: 'pending' | 'registered' | 'skipped'
          privacy_agreed_at?: string
          created_at?: string
          updated_at?: string
          postcode?: string | null
          road_address?: string | null
          jibun_address?: string | null
          address_extra?: string | null
          preferred_visit_date?: string | null
          preferred_visit_time_slot?: string | null
          interest_categories?: string[] | null
          is_manual_address?: boolean
          referrer_name?: string | null
        }
      }
      measurement_media: {
        Row: {
          id: string
          request_id: string
          customer_id: string
          bucket: string
          object_path: string
          media_type: 'image' | 'video'
          file_name: string
          file_size: number
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          customer_id: string
          bucket?: string
          object_path: string
          media_type: 'image' | 'video'
          file_name: string
          file_size?: number
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          customer_id?: string
          bucket?: string
          object_path?: string
          media_type?: 'image' | 'video'
          file_name?: string
          file_size?: number
          created_at?: string
        }
      }
      measurement_request_events: {
        Row: {
          id: string
          request_id: string
          actor_id: string
          event_type: string
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          actor_id: string
          event_type: string
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          actor_id?: string
          event_type?: string
          memo?: string | null
          created_at?: string
        }
      }
      measurement_product_categories: {
        Row: {
          id: string
          key: string
          label: string
          description: string | null
          image_url: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          description?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          description?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      measurement_booking_settings: {
        Row: {
          id: number
          min_days_out: number
          max_days_out: number
          close_saturday: boolean
          close_sunday: boolean
          close_holidays: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          min_days_out?: number
          max_days_out?: number
          close_saturday?: boolean
          close_sunday?: boolean
          close_holidays?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          min_days_out?: number
          max_days_out?: number
          close_saturday?: boolean
          close_sunday?: boolean
          close_holidays?: boolean
          updated_at?: string
        }
      }
      measurement_date_overrides: {
        Row: {
          date: string
          is_closed: boolean
          memo: string | null
          source: 'manual' | 'holiday'
          created_at: string
        }
        Insert: {
          date: string
          is_closed: boolean
          memo?: string | null
          source?: 'manual' | 'holiday'
          created_at?: string
        }
        Update: {
          date?: string
          is_closed?: boolean
          memo?: string | null
          source?: 'manual' | 'holiday'
          created_at?: string
        }
      }
    }
    Enums: {
      profile_role: 'customer' | 'sales_manager' | 'administrator'
      measurement_status: 'submitted' | 'appsheet_pending' | 'appsheet_registered' | 'contacted' | 'assigned' | 'scheduled' | 'measured' | 'cancelled'
      product_family: 'middle_door' | 'abs_door' | 'front_door' | 'molding_baseboard' | 'other'
      appsheet_status: 'pending' | 'registered' | 'skipped'
    }
  }
}
