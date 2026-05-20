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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_preview_payload: {
        Args: { p_token: string }
        Returns: Json
      }
    }
  }
}
