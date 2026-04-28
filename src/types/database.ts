export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  colorbook: {
    Tables: {
      site_settings: {
        Row: {
          id: string
          site_title: string | null
          site_description: string | null
          og_image_url: string | null
          reservation_url: string | null
          store_url: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          site_title?: string | null
          site_description?: string | null
          og_image_url?: string | null
          reservation_url?: string | null
          store_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          site_title?: string | null
          site_description?: string | null
          og_image_url?: string | null
          reservation_url?: string | null
          store_url?: string | null
          updated_at?: string | null
        }
      }
      collections: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          thumbnail_url: string | null
          display_order: number
          status: 'draft' | 'published'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          thumbnail_url?: string | null
          display_order?: number
          status?: 'draft' | 'published'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          thumbnail_url?: string | null
          display_order?: number
          status?: 'draft' | 'published'
          created_at?: string | null
          updated_at?: string | null
        }
      }
      colors: {
        Row: {
          id: string
          collection_id: string
          name: string
          slug: string
          tagline: string | null
          description: string | null
          texture_image_url: string | null
          display_order: number
          status: 'draft' | 'published'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          collection_id: string
          name: string
          slug: string
          tagline?: string | null
          description?: string | null
          texture_image_url: string | null
          display_order?: number
          status?: 'draft' | 'published'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          collection_id?: string
          name?: string
          slug?: string
          tagline?: string | null
          description?: string | null
          texture_image_url?: string | null
          display_order?: number
          status?: 'draft' | 'published'
          created_at?: string | null
          updated_at?: string | null
        }
      }
      installation_photos: {
        Row: {
          id: string
          color_id: string
          image_url: string
          caption: string | null
          display_order: number
          created_at: string | null
        }
        Insert: {
          id?: string
          color_id: string
          image_url: string
          caption?: string | null
          display_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          color_id?: string
          image_url?: string
          caption?: string | null
          display_order?: number
          created_at?: string | null
        }
      }
      preview_tokens: {
        Row: {
          id: string
          color_id: string
          token: string
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          color_id: string
          token: string
          expires_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          color_id?: string
          token?: string
          expires_at?: string
          created_at?: string | null
        }
      }
    }
  }
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
          hero_title: string | null
          hero_subtitle: string | null
          hero_description: string | null
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
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
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
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
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
          hero_title: string | null
          hero_subtitle: string | null
          hero_description: string | null
          tagline: string | null
          description: string | null
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
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          tagline?: string | null
          description?: string | null
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
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          tagline?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      hero_media: {
        Row: {
          id: string
          node_id: string
          image_url: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          node_id: string
          image_url: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          node_id?: string
          image_url?: string
          display_order?: number
          created_at?: string
        }
      }
      site_hero_media: {
        Row: {
          id: string
          image_url: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          image_url: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          image_url?: string
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
}
