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
}
