export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CustomerRequestStatus =
  | 'confirmation_pending'
  | 'confirmed'
  | 'change_pending'
  | 'change_confirmed'
  | 'cancel_pending'
  | 'cancel_confirmed'

export type QueueWorkStatus =
  | 'new_received'
  | 'new_done'
  | 'change_received'
  | 'change_done'
  | 'cancel_received'
  | 'cancel_done'

export type QueueSourceType = 'measurement' | 'as'

export type BlogPostStatus =
  | 'ai_draft'
  | 'reviewing'
  | 'needs_media'
  | 'ready'
  | 'published'
  | 'archived'

export type BlogContentCategory =
  | 'case_study'
  | 'product_guide'
  | 'customer_qa'
  | 'field_knowhow'
  | 'price_guide'
  | 'area_guide'

export type BlogBlockType = 'heading' | 'paragraph' | 'image' | 'cta' | 'qa'

export type BlogMediaUsageStatus = 'candidate' | 'approved' | 'published' | 'rejected'

export type BlogMediaSourceType =
  | 'manual_upload'
  | 'measurement_media'
  | 'as_media'
  | 'external_reference'
  | 'showroom_asset'

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
      blog_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          seo_title: string | null
          meta_description: string | null
          canonical_url: string | null
          status: BlogPostStatus
          category: BlogContentCategory
          primary_keyword: string | null
          target_question: string | null
          summary_answer: string | null
          related_questions: Json
          service_area: string | null
          product_type: string | null
          source_evidence: Json
          brand_check_result: Json
          ai_model: string | null
          source_prompt: string | null
          ai_citation_ready: boolean
          last_fact_checked_at: string | null
          media_missing_reason: string | null
          created_by: string | null
          reviewed_by: string | null
          published_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          seo_title?: string | null
          meta_description?: string | null
          canonical_url?: string | null
          status?: BlogPostStatus
          category: BlogContentCategory
          primary_keyword?: string | null
          target_question?: string | null
          summary_answer?: string | null
          related_questions?: Json
          service_area?: string | null
          product_type?: string | null
          source_evidence?: Json
          brand_check_result?: Json
          ai_model?: string | null
          source_prompt?: string | null
          ai_citation_ready?: boolean
          last_fact_checked_at?: string | null
          media_missing_reason?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          published_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          seo_title?: string | null
          meta_description?: string | null
          canonical_url?: string | null
          status?: BlogPostStatus
          category?: BlogContentCategory
          primary_keyword?: string | null
          target_question?: string | null
          summary_answer?: string | null
          related_questions?: Json
          service_area?: string | null
          product_type?: string | null
          source_evidence?: Json
          brand_check_result?: Json
          ai_model?: string | null
          source_prompt?: string | null
          ai_citation_ready?: boolean
          last_fact_checked_at?: string | null
          media_missing_reason?: string | null
          created_by?: string | null
          reviewed_by?: string | null
          published_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      blog_media: {
        Row: {
          id: string
          post_id: string | null
          source_type: BlogMediaSourceType
          source_measurement_media_id: string | null
          source_as_media_id: string | null
          private_bucket: string | null
          private_object_path: string | null
          public_bucket: string | null
          public_object_path: string | null
          public_url: string | null
          alt_text: string | null
          caption: string | null
          source_label: string | null
          usage_status: BlogMediaUsageStatus
          privacy_checked: boolean
          promotion_consent_checked: boolean
          used_as_cover: boolean
          approved_by: string | null
          approved_at: string | null
          published_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id?: string | null
          source_type: BlogMediaSourceType
          source_measurement_media_id?: string | null
          source_as_media_id?: string | null
          private_bucket?: string | null
          private_object_path?: string | null
          public_bucket?: string | null
          public_object_path?: string | null
          public_url?: string | null
          alt_text?: string | null
          caption?: string | null
          source_label?: string | null
          usage_status?: BlogMediaUsageStatus
          privacy_checked?: boolean
          promotion_consent_checked?: boolean
          used_as_cover?: boolean
          approved_by?: string | null
          approved_at?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string | null
          source_type?: BlogMediaSourceType
          source_measurement_media_id?: string | null
          source_as_media_id?: string | null
          private_bucket?: string | null
          private_object_path?: string | null
          public_bucket?: string | null
          public_object_path?: string | null
          public_url?: string | null
          alt_text?: string | null
          caption?: string | null
          source_label?: string | null
          usage_status?: BlogMediaUsageStatus
          privacy_checked?: boolean
          promotion_consent_checked?: boolean
          used_as_cover?: boolean
          approved_by?: string | null
          approved_at?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      blog_blocks: {
        Row: {
          id: string
          post_id: string
          display_order: number
          type: BlogBlockType
          heading_level: number | null
          text: string | null
          media_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          display_order: number
          type: BlogBlockType
          heading_level?: number | null
          text?: string | null
          media_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          display_order?: number
          type?: BlogBlockType
          heading_level?: number | null
          text?: string | null
          media_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      blog_post_events: {
        Row: {
          id: string
          post_id: string
          actor_id: string | null
          event_type: string
          from_status: BlogPostStatus | null
          to_status: BlogPostStatus | null
          memo: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          actor_id?: string | null
          event_type: string
          from_status?: BlogPostStatus | null
          to_status?: BlogPostStatus | null
          memo?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          actor_id?: string | null
          event_type?: string
          from_status?: BlogPostStatus | null
          to_status?: BlogPostStatus | null
          memo?: string | null
          metadata?: Json
          created_at?: string
        }
      }
    }
    Enums: {
      blog_post_status: BlogPostStatus
      blog_content_category: BlogContentCategory
      blog_block_type: BlogBlockType
      blog_media_usage_status: BlogMediaUsageStatus
      blog_media_source_type: BlogMediaSourceType
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
          applicant_relationship: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_relationship: string | null
          additional_contacts: Json
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
          service_region: string | null
          service_region_status: 'supported' | 'chungcheong_limited' | 'unsupported' | 'unknown'
          customer_status: CustomerRequestStatus
          queue_status: QueueWorkStatus
          customer_action_note: string | null
          customer_action_requested_at: string | null
          processed_at: string | null
          processed_by: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          customer_name: string
          phone: string
          applicant_relationship?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          additional_contacts?: Json
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
          service_region?: string | null
          service_region_status?: 'supported' | 'chungcheong_limited' | 'unsupported' | 'unknown'
          customer_status?: CustomerRequestStatus
          queue_status?: QueueWorkStatus
          customer_action_note?: string | null
          customer_action_requested_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          customer_name?: string
          phone?: string
          applicant_relationship?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          additional_contacts?: Json
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
          service_region?: string | null
          service_region_status?: 'supported' | 'chungcheong_limited' | 'unsupported' | 'unknown'
          customer_status?: CustomerRequestStatus
          queue_status?: QueueWorkStatus
          customer_action_note?: string | null
          customer_action_requested_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
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
      as_requests: {
        Row: {
          id: string
          customer_id: string
          customer_name: string
          phone: string
          contact_name: string | null
          contact_phone: string | null
          contact_relationship: string | null
          address: string | null
          address_detail: string | null
          issue_type: string
          urgency: 'normal' | 'urgent'
          preferred_contact_method: 'phone' | 'sms' | 'kakao'
          message: string
          status: 'submitted' | 'reviewing' | 'scheduled' | 'resolved' | 'cancelled'
          privacy_agreed_at: string
          created_at: string
          updated_at: string
          postcode: string | null
          road_address: string | null
          jibun_address: string | null
          address_extra: string | null
          is_manual_address: boolean
          customer_status: CustomerRequestStatus
          queue_status: QueueWorkStatus
          customer_action_note: string | null
          customer_action_requested_at: string | null
          processed_at: string | null
          processed_by: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          customer_name: string
          phone: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          address?: string | null
          address_detail?: string | null
          issue_type?: string
          urgency?: 'normal' | 'urgent'
          preferred_contact_method?: 'phone' | 'sms' | 'kakao'
          message: string
          status?: 'submitted' | 'reviewing' | 'scheduled' | 'resolved' | 'cancelled'
          privacy_agreed_at?: string
          created_at?: string
          updated_at?: string
          postcode?: string | null
          road_address?: string | null
          jibun_address?: string | null
          address_extra?: string | null
          is_manual_address?: boolean
          customer_status?: CustomerRequestStatus
          queue_status?: QueueWorkStatus
          customer_action_note?: string | null
          customer_action_requested_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          customer_name?: string
          phone?: string
          contact_name?: string | null
          contact_phone?: string | null
          contact_relationship?: string | null
          address?: string | null
          address_detail?: string | null
          issue_type?: string
          urgency?: 'normal' | 'urgent'
          preferred_contact_method?: 'phone' | 'sms' | 'kakao'
          message?: string
          status?: 'submitted' | 'reviewing' | 'scheduled' | 'resolved' | 'cancelled'
          privacy_agreed_at?: string
          created_at?: string
          updated_at?: string
          postcode?: string | null
          road_address?: string | null
          jibun_address?: string | null
          address_extra?: string | null
          is_manual_address?: boolean
          customer_status?: CustomerRequestStatus
          queue_status?: QueueWorkStatus
          customer_action_note?: string | null
          customer_action_requested_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
        }
      }
      as_media: {
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
      request_action_events: {
        Row: {
          id: string
          source_type: QueueSourceType
          source_id: string
          actor_id: string | null
          actor_role: 'customer' | 'sales_manager' | 'administrator' | 'system'
          event_type: string
          from_customer_status: CustomerRequestStatus | null
          to_customer_status: CustomerRequestStatus | null
          from_queue_status: QueueWorkStatus | null
          to_queue_status: QueueWorkStatus | null
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          source_type: QueueSourceType
          source_id: string
          actor_id?: string | null
          actor_role: 'customer' | 'sales_manager' | 'administrator' | 'system'
          event_type: string
          from_customer_status?: CustomerRequestStatus | null
          to_customer_status?: CustomerRequestStatus | null
          from_queue_status?: QueueWorkStatus | null
          to_queue_status?: QueueWorkStatus | null
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          source_type?: QueueSourceType
          source_id?: string
          actor_id?: string | null
          actor_role?: 'customer' | 'sales_manager' | 'administrator' | 'system'
          event_type?: string
          from_customer_status?: CustomerRequestStatus | null
          to_customer_status?: CustomerRequestStatus | null
          from_queue_status?: QueueWorkStatus | null
          to_queue_status?: QueueWorkStatus | null
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
